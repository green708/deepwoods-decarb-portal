<?php
// ghg/setup-client.php — POST /backend/api/ghg/setup-client.php
// Deepwoods admin only: bootstraps a client's GHG tracking rows in the
// Google Sheet via Apps Script (Master_Index + generic GHG_Datapoints).
//
// POST { client_id: 123 }
//   → for each non-consolidated entity, calls Apps Script action=setupNewClient
//   → marks ghg_setup_done=true in client_config on success
//   → returns { ok, results: [{ entityCode, clientId, ... }] }

declare(strict_types=1);
require_once __DIR__ . '/../db.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Allow-Methods: POST, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { dolphin_send_json(['error' => 'POST only'], 405); }

$authUser = dolphin_require_auth();
if ($authUser['role'] !== 'deepwoods_admin') {
    dolphin_send_json(['error' => 'deepwoods_admin role required'], 403);
}

$config   = dolphin_config();
$pdo      = dolphin_db();
$body     = dolphin_json_body();
$clientId = isset($body['client_id']) ? (int)$body['client_id'] : 0;

if (!$clientId) {
    dolphin_send_json(['error' => 'client_id is required'], 400);
}

// ── Fetch client ──────────────────────────────────────────────────────────────

$cStmt = $pdo->prepare(
    'SELECT id, name, slug, drive_root_folder_id, reporting_period FROM clients WHERE id = ?'
);
$cStmt->execute([$clientId]);
$client = $cStmt->fetch();
if (!$client) { dolphin_send_json(['error' => 'Client not found'], 404); }

// ── Fetch config values ───────────────────────────────────────────────────────

$cfgStmt = $pdo->prepare(
    'SELECT config_key, config_value FROM client_config WHERE client_id = ?'
);
$cfgStmt->execute([$clientId]);
$cfgRows = $cfgStmt->fetchAll(\PDO::FETCH_KEY_PAIR);

$entityScopeJson  = isset($cfgRows['entity_scope_json'])
    ? json_decode($cfgRows['entity_scope_json'], true) : [];
$fyStartMonth     = (int)($cfgRows['fiscal_year_start_month'] ?? 4);
$reportingYearsRaw = isset($cfgRows['reporting_years'])
    ? json_decode($cfgRows['reporting_years'], true) : [];

// Derive the current FY label from client config or date
$currentFY = !empty($reportingYearsRaw)
    ? (string)$reportingYearsRaw[0]
    : _derive_fy($fyStartMonth);

// ── Fetch non-consolidated entities ──────────────────────────────────────────

$eStmt = $pdo->prepare(
    'SELECT code, name FROM client_entities WHERE client_id = ? AND is_consolidated = 0 ORDER BY sort_order'
);
$eStmt->execute([$clientId]);
$entities = $eStmt->fetchAll();

if (empty($entities)) {
    dolphin_send_json(['error' => 'No non-consolidated entities found for this client'], 400);
}

// ── Fetch primary client contact email ────────────────────────────────────────

$emailStmt = $pdo->prepare(
    "SELECT email FROM users WHERE client_id = ? AND role = 'sustainability_team'
     ORDER BY created_at LIMIT 1"
);
$emailStmt->execute([$clientId]);
$clientEmail = (string)($emailStmt->fetchColumn() ?: '');

$consultEmail = $config['smtp']['from_email'] ?? '';

// ── Call Apps Script for each entity ─────────────────────────────────────────

$ghgWebappUrl = $config['ghg_webapp_url'] ?? '';
$slug         = strtoupper((string)$client['slug']);
$results      = [];
$anyError     = false;
$anySkipped   = false;

foreach ($entities as $entity) {
    $entityCode = strtoupper(trim((string)$entity['code']));
    $ghgClientId = "{$slug}-{$entityCode}-GHG-{$currentFY}";

    // Per-entity scope config from entity_scope_json (falls back to empty = all false)
    $sc = is_array($entityScopeJson) && isset($entityScopeJson[$entityCode])
        ? $entityScopeJson[$entityCode]
        : [];

    // Map s3_categories to "cat1", "cat2" etc.
    // setup.tsx writes s3_categories as integers [1,4,6,7] inside entity_scope_json.
    // Global s3_boundary is stored as ["Cat 1","Cat 4",...] — used as fallback.
    $s3cats = [];
    if (!empty($sc['s3_categories']) && is_array($sc['s3_categories'])) {
        // Per-entity integer array — primary source
        foreach ($sc['s3_categories'] as $n) {
            if (is_numeric($n)) { $s3cats[] = "cat" . (int)$n; }
        }
    } elseif (!empty($cfgRows['s3_boundary'])) {
        // Global fallback: "Cat N" string format written by client-setup.php
        foreach (json_decode($cfgRows['s3_boundary'], true) ?? [] as $label) {
            $n = preg_replace('/[^0-9]/', '', $label);
            if ($n !== '') { $s3cats[] = "cat{$n}"; }
        }
    }

    $scopeConfig = [
        's1_stationary' => !empty($sc['s1_stationary']),
        's1_mobile'     => !empty($sc['s1_mobile']),
        's1_fugitive'   => !empty($sc['s1_fugitive']),
        's2_grid'       => !empty($sc['s2_grid']),
        's2_renewable'  => !empty($sc['s2_renewable']),
        's3_included'   => !empty($sc['s3_included']),
        's3_categories' => $s3cats,
    ];

    if (!$ghgWebappUrl) {
        // Apps Script not configured — record the payload that would have been sent
        $anySkipped = true;
        $results[] = [
            'entityCode'     => $entityCode,
            'ghgClientId'    => $ghgClientId,
            'status'         => 'skipped',
            'reason'         => 'ghg_webapp_url not configured in backend/config.php',
            'payload'        => [
                'action'       => 'setupNewClient',
                'clientId'     => $ghgClientId,
                'entityCode'   => $entityCode,
                'entityName'   => $entity['name'],
                'fy'           => $currentFY,
                'consultEmail' => $consultEmail,
                'clientEmail'  => $clientEmail,
                'driveFolderId'=> $client['drive_root_folder_id'] ?? '',
                'scopeConfig'  => $scopeConfig,
            ],
        ];
        continue;
    }

    $payload = json_encode([
        'action'        => 'setupNewClient',
        'clientId'      => $ghgClientId,
        'entityCode'    => $entityCode,
        'entityName'    => (string)$entity['name'],
        'fy'            => $currentFY,
        'consultEmail'  => $consultEmail,
        'clientEmail'   => $clientEmail,
        'driveFolderId' => $client['drive_root_folder_id'] ?? '',
        'scopeConfig'   => $scopeConfig,
    ]);

    $ch = curl_init($ghgWebappUrl);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_TIMEOUT        => 30,
    ]);
    $raw  = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);
    curl_close($ch);

    if ($err || $code < 200 || $code >= 300) {
        $anyError = true;
        $results[] = [
            'entityCode'  => $entityCode,
            'ghgClientId' => $ghgClientId,
            'status'      => 'error',
            'httpCode'    => $code,
            'error'       => $err ?: $raw,
        ];
    } else {
        $decoded = json_decode($raw, true);
        $results[] = array_merge(
            ['entityCode' => $entityCode, 'ghgClientId' => $ghgClientId, 'status' => 'ok'],
            is_array($decoded) ? $decoded : ['raw' => $raw]
        );
    }
}

// ── Mark setup done if all calls succeeded (not skipped) ─────────────────────

if (!$anyError && !$anySkipped) {
    $pdo->prepare(
        'INSERT INTO client_config (client_id, config_key, config_value)
         VALUES (?, "ghg_setup_done", "true")
         ON DUPLICATE KEY UPDATE config_value = "true"'
    )->execute([$clientId]);
}

dolphin_send_json([
    'ok'      => !$anyError,
    'client'  => $client['name'],
    'fy'      => $currentFY,
    'results' => $results,
]);


// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Derive FY label from the current date and the client's fiscal year start month.
 * Convention: FY = the calendar year in which the fiscal year ENDS.
 * e.g. April 2025 – March 2026 → "FY26"
 */
function _derive_fy(int $startMonth): string {
    $now   = new \DateTime();
    $year  = (int)$now->format('Y');
    $month = (int)$now->format('n');
    // If current month is at/after the start month, we're in the FY that starts this year
    // and ends next year (for start=April: April 2026 → FY27).
    // If before the start month, we're in the FY that started last year → ends this year.
    $endYear = ($month >= $startMonth) ? $year + 1 : $year;
    return 'FY' . substr((string)$endYear, -2);
}
