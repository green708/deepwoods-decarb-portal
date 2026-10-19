<?php
// admin/portfolio.php — GET. Deepwoods staff portfolio list + attention queue.
//
// Query cost is independent of client count except for the IN-lists: every aggregate is one grouped
// statement. The per-FY statements (cycles, calc, tracker coverage) run once per DISTINCT current
// fiscal-year label across the portfolio (normally 1-3), never once per client.

declare(strict_types=1);
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../lib_admin.php';
require_once __DIR__ . '/../lib_portal.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Headers: Content-Type, X-Api-Key, Authorization');
header('Access-Control-Allow-Methods: GET, OPTIONS');

$user = dolphin_require_auth();
dolphin_require_deepwoods($user);
dolphin_require_method(['GET']);
$pdo = dolphin_db();

$statusFilter = (string)($_GET['status'] ?? 'all');
if (!in_array($statusFilter, ['all', 'active', 'pending_activation', 'awaiting_payment', 'attention'], true)) {
    dolphin_send_json(['error' => 'Invalid status filter'], 400);
}
$sort = (string)($_GET['sort'] ?? 'attention');
if (!in_array($sort, ['name', 'attention', 'due', 'owner'], true)) {
    dolphin_send_json(['error' => 'Invalid sort'], 400);
}
$q       = trim((string)($_GET['q'] ?? ''));
$owner   = trim((string)($_GET['owner'] ?? ''));
$page    = max(1, (int)($_GET['page'] ?? 1));
$perPage = (int)($_GET['per_page'] ?? 25);
$perPage = $perPage < 1 ? 25 : min($perPage, 100);
$today   = dolphin_today();

/** @return string "?,?,?" for an IN list */
$marks = static fn(array $a): string => implode(',', array_fill(0, count($a), '?'));

// ── Base rows ────────────────────────────────────────────────────────────────
$clients = $pdo->query(
    'SELECT id, name, slug, primary_color, is_active, payment_status, reporting_period, account_owner
     FROM clients'
)->fetchAll();

$cfgRows = $pdo->query(
    "SELECT client_id, config_key, config_value FROM client_config
     WHERE config_key IN ('current_fy', 'fiscal_year_start_month', 'selected_plan')"
)->fetchAll();
$cfg = [];
foreach ($cfgRows as $r) $cfg[(int)$r['client_id']][$r['config_key']] = $r['config_value'];

$userRows = $pdo->query(
    'SELECT u.client_id, COUNT(DISTINCT u.id) AS user_count, MAX(s.created_at) AS last_login
     FROM users u LEFT JOIN sessions s ON s.user_id = u.id
     WHERE u.client_id IS NOT NULL
     GROUP BY u.client_id'
)->fetchAll();
$usersBy = [];
foreach ($userRows as $r) $usersBy[(int)$r['client_id']] = $r;

$queryRows = $pdo->query(
    "SELECT client_id, COUNT(*) AS open_count, MIN(id) AS oldest_id
     FROM ndc_threads WHERE last_from_role = 'client' GROUP BY client_id"
)->fetchAll();
$queriesBy = [];
foreach ($queryRows as $r) $queriesBy[(int)$r['client_id']] = $r;

$newRequestCount = (int)$pdo->query("SELECT COUNT(*) FROM client_requests WHERE status = 'new'")->fetchColumn();
$newRequests = $pdo->query(
    "SELECT id, company FROM client_requests WHERE status = 'new' ORDER BY created_at DESC, id DESC LIMIT 15"
)->fetchAll();

// ── Per-FY grouped aggregates ───────────────────────────────────────────────
$fyOf = [];
$idsByFy = [];
foreach ($clients as $c) {
    $id = (int)$c['id'];
    $fy = dolphin_client_fy($c, $cfg[$id] ?? []);
    $fyOf[$id] = $fy;
    $idsByFy[$fy][] = $id;
}

$cycleRows = [];   // [client_id] => rows for dolphin_agg_cycle
$calcRows  = [];   // [client_id] => rows for dolphin_agg_calc
$sourcesBy = [];   // [client_id] => [total, with_data]

foreach ($idsByFy as $fy => $ids) {
    $in = $marks($ids);

    $st = $pdo->prepare(
        "SELECT ce.client_id, rc.status, rc.data_due_date, rc.report_due_date, rc.submitted_at, rc.submitted_by
         FROM client_entities ce
         LEFT JOIN reporting_cycles rc
                ON rc.client_id = ce.client_id AND rc.entity = ce.code AND rc.fiscal_year = ?
         WHERE ce.is_consolidated = 0 AND ce.client_id IN ($in)"
    );
    $st->execute(array_merge([$fy], $ids));
    foreach ($st->fetchAll() as $r) $cycleRows[(int)$r['client_id']][] = $r;

    $st = $pdo->prepare(
        "SELECT ce.client_id, cs.status, cs.calculated_at, cs.verified_at, cs.ef_version
         FROM client_entities ce
         LEFT JOIN calc_status cs
                ON cs.client_id = ce.client_id AND cs.entity = ce.code AND cs.fiscal_year = ?
         WHERE ce.is_consolidated = 0 AND ce.client_id IN ($in)"
    );
    $st->execute(array_merge([$fy], $ids));
    foreach ($st->fetchAll() as $r) $calcRows[(int)$r['client_id']][] = $r;

    // The correlated EXISTS probes uniq_draft_cell on its full (client_id, entity, fiscal_year, asset_id) prefix.
    $st = $pdo->prepare(
        "SELECT a.client_id, COUNT(*) AS total,
                SUM(EXISTS (SELECT 1 FROM tracker_drafts t
                            WHERE t.client_id = a.client_id AND t.entity = a.entity
                              AND t.fiscal_year = ? AND t.asset_id = a.asset_id)) AS with_data
         FROM decarb_assets a
         WHERE a.client_id IN ($in)
         GROUP BY a.client_id"
    );
    $st->execute(array_merge([$fy], $ids));
    foreach ($st->fetchAll() as $r) $sourcesBy[(int)$r['client_id']] = [(int)$r['total'], (int)$r['with_data']];
}

// ── Assemble ────────────────────────────────────────────────────────────────
$rows = [];
$summary = [
    'clients' => count($clients), 'active' => 0, 'awaiting_payment' => 0, 'pending_activation' => 0,
    'new_requests' => $newRequestCount, 'open_queries' => 0, 'overdue_cycles' => 0, 'to_verify' => 0,
];
$attention = [];

foreach ($clients as $c) {
    $id      = (int)$c['id'];
    $active  = (bool)$c['is_active'];
    $unpaid  = ($c['payment_status'] ?? 'pending') === 'pending';
    $u       = $usersBy[$id] ?? null;
    $userCnt = $u ? (int)$u['user_count'] : 0;
    $cycle   = dolphin_agg_cycle($cycleRows[$id] ?? [], $today);
    $calc    = dolphin_agg_calc($calcRows[$id] ?? []);
    $openQ   = (int)($queriesBy[$id]['open_count'] ?? 0);
    [$srcTotal, $srcData] = $sourcesBy[$id] ?? [0, 0];

    $flags = [];
    if ($cycle['overdue'])        $flags[] = 'overdue';
    if ($calc['to_verify'] > 0)   $flags[] = 'to_verify';
    if ($openQ > 0)               $flags[] = 'open_query';
    if ($userCnt === 0)           $flags[] = 'no_users';
    if ($unpaid)                  $flags[] = 'unpaid';
    if (!$active)                 $flags[] = 'inactive';
    if ($srcData === 0)           $flags[] = 'no_data';

    if ($active) $summary['active']++; else $summary['pending_activation']++;
    if ($unpaid) $summary['awaiting_payment']++;
    $summary['open_queries'] += $openQ;
    if ($cycle['overdue']) $summary['overdue_cycles']++;
    $summary['to_verify'] += $calc['to_verify'];

    $name = (string)$c['name'];
    if ($cycle['overdue']) {
        $attention[] = ['type' => 'overdue_cycle', 'severity' => 'high', 'client_id' => $id, 'client_name' => $name,
            'label' => 'Data submission overdue (due ' . $cycle['data_due_date'] . ')', 'link' => 'clients', 'ref_id' => null];
    }
    if ($openQ > 0) {
        $attention[] = ['type' => 'open_query', 'severity' => 'medium', 'client_id' => $id, 'client_name' => $name,
            'label' => $openQ . ' open ' . ($openQ === 1 ? 'query' : 'queries') . ' awaiting reply', 'link' => 'inbox',
            'ref_id' => (int)$queriesBy[$id]['oldest_id']];
    }
    if ($calc['to_verify'] > 0) {
        $attention[] = ['type' => 'to_verify', 'severity' => 'medium', 'client_id' => $id, 'client_name' => $name,
            'label' => $calc['to_verify'] . ' ' . ($calc['to_verify'] === 1 ? 'entity' : 'entities') . ' calculated, awaiting verification',
            'link' => 'clients', 'ref_id' => null];
    }
    if ($unpaid) {
        $attention[] = ['type' => 'awaiting_payment', 'severity' => 'medium', 'client_id' => $id, 'client_name' => $name,
            'label' => 'Awaiting payment confirmation', 'link' => 'clients', 'ref_id' => null];
    }
    if ($active && $userCnt === 0) {
        $attention[] = ['type' => 'no_users', 'severity' => 'medium', 'client_id' => $id, 'client_name' => $name,
            'label' => 'Active client has no users', 'link' => 'clients', 'ref_id' => null];
    }
    if ($cycle['submitted_entities'] > 0 && $calc['status'] === 'draft') {
        $attention[] = ['type' => 'submitted', 'severity' => 'low', 'client_id' => $id, 'client_name' => $name,
            'label' => 'Data submitted (' . $cycle['submitted_entities'] . '/' . $cycle['entities'] . ' entities), ready to calculate',
            'link' => 'clients', 'ref_id' => null];
    }

    $rows[] = [
        'id' => $id,
        'name' => $name,
        'slug' => $c['slug'],
        'logo_url' => null,
        'primary_color' => $c['primary_color'],
        'is_active' => $active,
        'payment_status' => $c['payment_status'],
        'reporting_period' => $c['reporting_period'],
        'plan' => ($cfg[$id]['selected_plan'] ?? '') !== '' ? $cfg[$id]['selected_plan'] : null,
        'account_owner' => ($c['account_owner'] ?? '') !== '' ? $c['account_owner'] : null,
        'entity_count' => $cycle['entities'],
        'user_count' => $userCnt,
        'last_login' => $u ? dolphin_iso($u['last_login']) : null,
        'fy' => $fyOf[$id],
        'sources_total' => $srcTotal,
        'sources_with_data' => $srcData,
        'cycle' => [
            'status' => $cycle['status'],
            'data_due_date' => $cycle['data_due_date'],
            'report_due_date' => $cycle['report_due_date'],
            'overdue' => $cycle['overdue'],
            'submitted_entities' => $cycle['submitted_entities'],
            'entities' => $cycle['entities'],
        ],
        'calc' => ['status' => $calc['status'], 'to_verify' => $calc['to_verify']],
        'open_queries' => $openQ,
        'flags' => $flags,
    ];
}

foreach ($newRequests as $r) {
    $attention[] = ['type' => 'new_request', 'severity' => 'high', 'client_id' => null, 'client_name' => null,
        'label' => 'New access request: ' . $r['company'], 'link' => 'requests', 'ref_id' => (int)$r['id']];
}
$sevRank  = ['high' => 0, 'medium' => 1, 'low' => 2];
$typeRank = ['new_request' => 0, 'overdue_cycle' => 1, 'open_query' => 2, 'to_verify' => 3,
             'awaiting_payment' => 4, 'no_users' => 5, 'submitted' => 6];
usort($attention, static function ($a, $b) use ($sevRank, $typeRank) {
    return [$sevRank[$a['severity']], $typeRank[$a['type']], (string)$a['client_name']]
       <=> [$sevRank[$b['severity']], $typeRank[$b['type']], (string)$b['client_name']];
});
$attention = array_slice($attention, 0, 40);

// ── Filter ──────────────────────────────────────────────────────────────────
$meEmail = strtolower((string)$user['email']);
$qLower  = mb_strtolower($q);
$ownerFilter = strtolower($owner);
$rows = array_values(array_filter($rows, static function ($r) use ($statusFilter, $q, $qLower, $owner, $ownerFilter, $meEmail) {
    if ($q !== '' && mb_strpos(mb_strtolower($r['name']), $qLower) === false && mb_strpos(mb_strtolower((string)$r['slug']), $qLower) === false) return false;
    if ($owner !== '' && $ownerFilter !== 'all') {
        $o = $r['account_owner'] === null ? null : strtolower($r['account_owner']);
        if ($ownerFilter === 'unassigned') { if ($o !== null) return false; }
        elseif ($ownerFilter === 'me')     { if ($o !== $meEmail) return false; }
        elseif ($o !== $ownerFilter)       { return false; }
    }
    switch ($statusFilter) {
        case 'active':             return $r['is_active'];
        case 'pending_activation': return !$r['is_active'];
        case 'awaiting_payment':   return in_array('unpaid', $r['flags'], true);
        case 'attention':          return (bool)array_intersect($r['flags'], ['overdue', 'to_verify', 'open_query', 'no_users']);
    }
    return true;
}));

// ── Sort ────────────────────────────────────────────────────────────────────
$score = static function ($r): int {
    $w = ['overdue' => 8, 'open_query' => 4, 'to_verify' => 3, 'no_users' => 2, 'unpaid' => 1];
    $s = 0;
    foreach ($r['flags'] as $f) $s += $w[$f] ?? 0;
    return $s;
};
$nameKey = static fn($r) => mb_strtolower($r['name']);
usort($rows, static function ($a, $b) use ($sort, $score, $nameKey) {
    switch ($sort) {
        case 'attention':
            $c = $score($b) <=> $score($a);
            break;
        case 'due':
            $da = $a['cycle']['status'] === 'open' ? $a['cycle']['data_due_date'] : null;
            $db = $b['cycle']['status'] === 'open' ? $b['cycle']['data_due_date'] : null;
            $c = ($da === null) <=> ($db === null) ?: strcmp((string)$da, (string)$db);
            break;
        case 'owner':
            $c = ($a['account_owner'] === null) <=> ($b['account_owner'] === null)
                ?: strcmp(strtolower((string)$a['account_owner']), strtolower((string)$b['account_owner']));
            break;
        default:
            $c = 0;
    }
    return $c ?: strcmp($nameKey($a), $nameKey($b));
});

$total = count($rows);
$rows  = array_slice($rows, ($page - 1) * $perPage, $perPage);

// logo_url can be a multi-KB data URI, so it is fetched for the visible page only.
if ($rows) {
    $pageIds = array_column($rows, 'id');
    $st = $pdo->prepare('SELECT id, logo_url FROM clients WHERE id IN (' . $marks($pageIds) . ')');
    $st->execute($pageIds);
    $logos = [];
    foreach ($st->fetchAll() as $r) $logos[(int)$r['id']] = $r['logo_url'];
    foreach ($rows as &$r) $r['logo_url'] = $logos[$r['id']] ?? null;
    unset($r);
}

dolphin_send_json([
    'summary'   => $summary,
    'attention' => $attention,
    'total'     => $total,
    'page'      => $page,
    'per_page'  => $perPage,
    'clients'   => $rows,
]);
