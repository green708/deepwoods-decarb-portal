<?php
// home-summary.php — GET ?entity=CODE&fy=LABEL. One call that feeds the client Home page.
// client_id always comes from the session. Targets use only values explicitly configured for the client.

declare(strict_types=1);
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/lib_admin.php';
require_once __DIR__ . '/lib_portal.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Headers: Content-Type, X-Api-Key, Authorization');
header('Access-Control-Allow-Methods: GET, OPTIONS');

$user = dolphin_require_auth();
dolphin_require_method(['GET']);
dolphin_require_active_client($user);
dolphin_require_payment($user);
$clientId = (int)($user['client_id'] ?? 0);
if (!$clientId) dolphin_send_json(['error' => 'No client associated with this account'], 403);
$pdo = dolphin_db();

$entityReq = trim((string)($_GET['entity'] ?? ''));
$entity    = dolphin_validate_entity($user, $entityReq);

$client = dolphin_client_or_404($pdo, $clientId);
$config = dolphin_client_config($pdo, $clientId);
$fy = trim((string)($_GET['fy'] ?? ''));
if ($fy === '') $fy = dolphin_client_fy($client, $config);
if (!dolphin_valid_fy($fy)) dolphin_send_json(['error' => 'Invalid fy'], 400);
$today = dolphin_today();

// Entities in scope: the consolidated code (or none) means every reporting entity.
$st = $pdo->prepare('SELECT code, is_consolidated FROM client_entities WHERE client_id = ? ORDER BY sort_order, id');
$st->execute([$clientId]);
$reporting = [];
$consolidatedCodes = [];
foreach ($st->fetchAll() as $e) {
    if ((int)$e['is_consolidated'] === 1) $consolidatedCodes[] = $e['code']; else $reporting[] = $e['code'];
}
$aggregate = $entity === '' || in_array($entity, $consolidatedCodes, true);
$scopeCodes = $aggregate ? $reporting : [$entity];
$respEntity = $entity !== '' ? $entity : ($consolidatedCodes[0] ?? '');

// Cycle and calc rows for the scoped entities (virtual open / draft when absent).
$cycleRows = []; $calcRows = [];
if ($scopeCodes) {
    $in = implode(',', array_fill(0, count($scopeCodes), '?'));
    $st = $pdo->prepare("SELECT entity, status, data_due_date, report_due_date, submitted_at, submitted_by
                         FROM reporting_cycles WHERE client_id = ? AND fiscal_year = ? AND entity IN ($in)");
    $st->execute(array_merge([$clientId, $fy], $scopeCodes));
    $cy = [];
    foreach ($st->fetchAll() as $r) $cy[$r['entity']] = $r;

    $st = $pdo->prepare("SELECT entity, status, calculated_at, verified_at, ef_version
                         FROM calc_status WHERE client_id = ? AND fiscal_year = ? AND entity IN ($in)");
    $st->execute(array_merge([$clientId, $fy], $scopeCodes));
    $ca = [];
    foreach ($st->fetchAll() as $r) $ca[$r['entity']] = $r;

    foreach ($scopeCodes as $code) {
        $cycleRows[] = $cy[$code] ?? ['status' => null, 'data_due_date' => null, 'report_due_date' => null, 'submitted_at' => null, 'submitted_by' => null];
        $calcRows[]  = $ca[$code] ?? ['status' => null, 'calculated_at' => null, 'verified_at' => null, 'ef_version' => null];
    }
}
$cycle = dolphin_agg_cycle($cycleRows, $today);
if ($cycle['status'] === 'none') $cycle['status'] = 'open';
$calc = dolphin_agg_calc($calcRows);
if ($calc['status'] === 'none') $calc['status'] = 'draft';
unset($calc['to_verify']);

// User display name
$st = $pdo->prepare('SELECT display_name FROM users WHERE id = ?');
$st->execute([$user['id']]);
$displayName = $st->fetchColumn();

// Consultant and targets: explicit client_config only.
$num = static function (?string $v): ?float { return $v !== null && is_numeric($v) ? (float)$v : null; };
$yr  = static function (?string $v): ?int { return $v !== null && ctype_digit($v) ? (int)$v : null; };
$goalPct = dolphin_cfg_str($config, 'sbti_target_s12');
$basis   = dolphin_cfg_str($config, 'target_basis');
$targets = [
    'set'                  => $goalPct !== null,
    'base_year'            => dolphin_cfg_str($config, 'base_year_s12') ?? dolphin_cfg_str($config, 'base_year'),
    'goal_pct'             => $num($goalPct),
    'goal_year'            => $yr(dolphin_cfg_str($config, 'sbti_target_year')),
    'netzero_year'         => $yr(dolphin_cfg_str($config, 'netzero_year')),
    'basis'                => in_array($basis, ['market', 'location'], true) ? $basis : null,
    'renewable_target_pct' => $num(dolphin_cfg_str($config, 'renewable_target_pct')),
    'residual_strategy'    => dolphin_cfg_str($config, 'residual_strategy'),
];

// Actions
$sql = 'SELECT status, COUNT(*) AS n, COALESCE(SUM(abatement_t), 0) AS planned, COALESCE(SUM(actual_abatement_t), 0) AS actual
        FROM decarb_actions WHERE client_id = ?';
$params = [$clientId];
if (!$aggregate) { $sql .= " AND (entity = ? OR entity = 'All')"; $params[] = $entity; }
$sql .= ' GROUP BY status';
$st = $pdo->prepare($sql);
$st->execute($params);
$byStatus = array_fill_keys(ACTION_STATUSES, 0);
$total = 0; $planned = 0.0; $actual = 0.0;
foreach ($st->fetchAll() as $r) {
    $byStatus[$r['status']] = ($byStatus[$r['status']] ?? 0) + (int)$r['n'];
    $total += (int)$r['n'];
    if ($r['status'] !== 'Cancelled') { $planned += (float)$r['planned']; $actual += (float)$r['actual']; }
}

// Replies waiting from Deepwoods (this FY)
$st = $pdo->prepare("SELECT COUNT(*) FROM ndc_threads WHERE client_id = ? AND fy = ? AND last_from_role = 'deepwoods'");
$st->execute([$clientId, $fy]);
$waitingReplies = (int)$st->fetchColumn();

// Alerts
$alerts = [];
if ($cycle['status'] === 'open' && $cycle['data_due_date'] !== null) {
    $d = $cycle['days_to_due'];
    if ($d < 0) {
        $n = -$d;
        $alerts[] = ['id' => 'cycle-overdue', 'severity' => 'high', 'title' => 'Data submission overdue',
            'detail' => "Data for $fy was due on {$cycle['data_due_date']} ($n " . ($n === 1 ? 'day' : 'days') . ' ago).', 'link' => '/submissions'];
    } elseif ($d <= 14) {
        $alerts[] = ['id' => 'cycle-due-soon', 'severity' => 'medium', 'title' => 'Data submission due soon',
            'detail' => "Data for $fy is due on {$cycle['data_due_date']} " . ($d === 0 ? '(today).' : "(in $d " . ($d === 1 ? 'day' : 'days') . ').'), 'link' => '/submissions'];
    }
}
if ($waitingReplies > 0) {
    $alerts[] = ['id' => 'replies-waiting', 'severity' => 'medium', 'title' => 'Reply waiting from Deepwoods',
        'detail' => $waitingReplies . ($waitingReplies === 1 ? ' query has' : ' queries have') . " a reply from the Deepwoods team for $fy.", 'link' => '/submissions'];
}
if (in_array($cycle['status'], ['submitted', 'locked'], true) && in_array($calc['status'], ['draft', 'calculated'], true)) {
    $alerts[] = ['id' => 'awaiting-verification', 'severity' => 'low', 'title' => 'Submitted data awaiting verification',
        'detail' => "Your $fy data has been submitted; Deepwoods is calculating and verifying results.", 'link' => '/submissions'];
}
if (in_array($calc['status'], ['verified', 'locked'], true) && !empty($calc['verified_at'])
    && strtotime((string)$calc['verified_at']) >= time() - 60 * 86400) {
    $alerts[] = ['id' => 'results-verified', 'severity' => 'low', 'title' => "$fy results verified",
        'detail' => 'Your emissions results have been calculated and verified by Deepwoods.', 'link' => '/overview'];
}
if (!$targets['set']) {
    $alerts[] = ['id' => 'targets-not-set', 'severity' => 'low', 'title' => 'Reduction targets not set',
        'detail' => 'No reduction target has been configured yet. Your Deepwoods consultant can set one up with you.', 'link' => '/progress'];
}
$sev = ['high' => 0, 'medium' => 1, 'low' => 2];
usort($alerts, static fn($a, $b) => $sev[$a['severity']] <=> $sev[$b['severity']]);

dolphin_send_json([
    'fy'     => $fy,
    'entity' => $respEntity,
    'user'   => ['display_name' => $displayName !== false && $displayName !== '' ? $displayName : null],
    'cycle'  => $cycle,
    'calc'   => $calc,
    'consultant' => [
        'name'  => dolphin_cfg_str($config, 'consultant_name'),
        'email' => dolphin_cfg_str($config, 'consultant_email'),
        'phone' => dolphin_cfg_str($config, 'consultant_phone'),
    ],
    'targets' => $targets,
    'actions' => ['total' => $total, 'by_status' => $byStatus, 'planned_abatement_t' => $planned, 'actual_abatement_t' => $actual],
    'alerts'  => $alerts,
]);
