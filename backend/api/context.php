<?php
// context.php — GET /backend/api/context.php
// Returns the full ClientContext for the authenticated user's client.
// Called once on login; response is cached in sessionStorage client-side.

require_once __DIR__ . '/db.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$user      = dolphin_require_auth();
$client_id = (int)($user['client_id'] ?? 0);

// ── Deepwoods staff (admin, coordinator) have no client_id ────────────────────
// Return a minimal platform context so they can reach /admin without a client.
$deepwoodsRoles = ['deepwoods_admin', 'deepwoods_coordinator'];
if (!$client_id && in_array($user['role'], $deepwoodsRoles, true)) {
    dolphin_send_json([
        'client' => [
            'id'               => 0,
            'name'             => 'Deepwoods Platform',
            'slug'             => 'deepwoods',
            'logo_url'         => '/deepwoods-logo.png',
            'primary_color'    => '#1E6F5C',
            'currency'         => 'INR',
            'reporting_period' => 'FY',
            'is_active'        => true,
        ],
        'entities'         => [],
        'reporting_years'  => [],
        'enabled_pages'    => ['workstreams', 'admin'],
        's3_boundary'      => [],
        's3_not_relevant'  => (object)[],
        'targets'          => [
            'base_year_s12'    => 'FY22',
            'base_year_s3'     => 'FY24',
            'netzero_year'     => 2040,
            'sbti_target_s12'  => 42.0,
            'sbti_target_year' => 2030,
        ],
        'config'           => (object)[],
    ]);
}

if (!$client_id) {
    dolphin_send_json(['error' => 'User is not associated with a client'], 403);
}

// ── 1. Client row ─────────────────────────────────────────────────────────────
$stmt = $pdo->prepare("SELECT * FROM clients WHERE id = ?");
$stmt->execute([$client_id]);
$client = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$client) { http_response_code(404); echo json_encode(['error' => 'Client not found']); exit; }

// ── 2. Entities ───────────────────────────────────────────────────────────────
$stmt = $pdo->prepare(
    "SELECT code, name, short_name AS short, is_consolidated,
            consolidates, sort_order
     FROM client_entities WHERE client_id = ? ORDER BY sort_order"
);
$stmt->execute([$client_id]);
$entities = $stmt->fetchAll(PDO::FETCH_ASSOC);
foreach ($entities as &$e) {
    $e['is_consolidated'] = (bool)$e['is_consolidated'];
    $e['consolidates']    = $e['consolidates'] ? json_decode($e['consolidates'], true) : null;
    $e['sort_order']      = (int)$e['sort_order'];
}
unset($e);

// ── entity_scope: scoped users see only their own entity ─────────────────────
if (!empty($user['entity_scope'])) {
    $scope = $user['entity_scope'];
    $entities = array_values(array_filter($entities, fn($e) => $e['code'] === $scope));
}

// ── 3. Reporting years ────────────────────────────────────────────────────────
$stmt = $pdo->prepare(
    "SELECT DISTINCT year FROM ghg_inventory
     WHERE client_id = ? ORDER BY year ASC"
);
$stmt->execute([$client_id]);
$years = array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'year');

// If no inventory yet, fall back to client_config
if (empty($years)) {
    $years = json_decode(getConfig($pdo, $client_id, 'reporting_years', '[]'), true);
}

// ── 4. Enabled pages ──────────────────────────────────────────────────────────
$enabled_pages = json_decode(getConfig($pdo, $client_id, 'enabled_pages',
    '["workstreams","overview","dashboard","inventory","hotspots","action-plan",
      "progress","peer","credits","reports","submissions","vault","methodology","priority-actions"]'),
    true
);

// ── 5. Scope 3 boundary ───────────────────────────────────────────────────────
$s3_boundary = json_decode(getConfig($pdo, $client_id, 's3_boundary',
    '["Cat 1","Cat 2","Cat 3","Cat 4","Cat 5","Cat 6","Cat 7","Cat 9","Cat 11","Cat 12"]'),
    true
);

$s3_not_relevant = json_decode(getConfig($pdo, $client_id, 's3_not_relevant', '{}'), true);

// ── 6. Targets ────────────────────────────────────────────────────────────────
$targets = [
    'base_year_s12'    => getConfig($pdo, $client_id, 'base_year_s12', 'FY22'),
    'base_year_s3'     => getConfig($pdo, $client_id, 'base_year_s3',  'FY24'),
    'netzero_year'     => (int)getConfig($pdo, $client_id, 'netzero_year', '2040'),
    'sbti_target_s12'  => (float)getConfig($pdo, $client_id, 'sbti_target_s12', '42'),
    'sbti_target_year' => (int)getConfig($pdo, $client_id, 'sbti_target_year', '2030'),
];

// ── 7. Catch-all config ───────────────────────────────────────────────────────
$stmt = $pdo->prepare("SELECT config_key, config_value FROM client_config WHERE client_id = ?");
$stmt->execute([$client_id]);
$config = [];
foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
    // Try JSON decode; fall back to raw string
    $val = json_decode($row['config_value'], true);
    $config[$row['config_key']] = ($val !== null) ? $val : $row['config_value'];
}

// ── 8. Reporting model & engagements ────────────────────────────────────────
$reporting_model_val = getConfig($pdo, $client_id, 'reporting_model', '');
$reporting_model = $reporting_model_val !== '' ? $reporting_model_val : null;

$reporting_engagements = [];
try {
    $re_stmt = $pdo->prepare(
        "SELECT id, name, report_type, legal_entity_codes, reporting_entity_code, sort_order
         FROM reporting_engagements WHERE client_id = ? ORDER BY sort_order, id"
    );
    $re_stmt->execute([$client_id]);
    foreach ($re_stmt->fetchAll(PDO::FETCH_ASSOC) as $re) {
        $reporting_engagements[] = [
            'id'                    => (int)$re['id'],
            'name'                  => $re['name'],
            'report_type'           => $re['report_type'],
            'legal_entity_codes'    => $re['legal_entity_codes']
                                        ? json_decode($re['legal_entity_codes'], true)
                                        : null,
            'reporting_entity_code' => $re['reporting_entity_code'],
            'sort_order'            => (int)$re['sort_order'],
        ];
    }
} catch (PDOException $e) {
    // Migration 002 not yet applied — return empty array
    $reporting_engagements = [];
}

// ── 9. Assemble response ─────────────────────────────────────────────────────
echo json_encode([
    'client' => [
        'id'               => (int)$client['id'],
        'name'             => $client['name'],
        'slug'             => $client['slug'],
        'logo_url'         => $client['logo_url'] ?? '/deepwoods-logo.png',
        'primary_color'    => $client['primary_color'] ?? '#1E6F5C',
        'currency'         => $client['currency'] ?? 'INR',
        'reporting_period' => $client['reporting_period'] ?? 'FY',
        'is_active'        => (bool)($client['is_active'] ?? false),
        'payment_status'   => $client['payment_status'] ?? 'pending',
        'invoice_ref'      => $client['invoice_ref']    ?? null,
        'payment_date'     => $client['payment_date']   ?? null,
        'activated_at'     => $client['activated_at']   ?? null,
    ],
    'entities'         => $entities,
    'reporting_years'  => $years,
    'enabled_pages'    => $enabled_pages,
    's3_boundary'      => $s3_boundary,
    's3_not_relevant'  => $s3_not_relevant,
    'targets'               => $targets,
    'config'                => $config,
    'reporting_model'       => $reporting_model,
    'reporting_engagements' => $reporting_engagements,
]);

// ── Helper ────────────────────────────────────────────────────────────────────
function getConfig(PDO $pdo, int $client_id, string $key, string $default): string {
    $stmt = $pdo->prepare(
        "SELECT config_value FROM client_config WHERE client_id = ? AND config_key = ?"
    );
    $stmt->execute([$client_id, $key]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ? $row['config_value'] : $default;
}
