<?php
// ghg/inventory.php — GET /backend/api/ghg/inventory.php?entity=<code>
// Returns all GHG inventory rows for one entity, all years.
// Response shape matches InventoryResponse in src/lib/api.ts

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_middleware.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$user      = requireAuth();
dolphin_require_active_client($user);
$client_id = (int)$user['client_id'];
$entity    = trim($_GET['entity'] ?? '');
// Enforce entity_scope — scoped users cannot query other entities
if (!empty($user['entity_scope'])) { $entity = $user['entity_scope']; }

// ── Fetch all metric rows for this entity ─────────────────────────────────────
$stmt = $pdo->prepare(
    "SELECT metric_key, year, metric_value
     FROM ghg_inventory
     WHERE client_id = ? AND entity = ?
     ORDER BY metric_key, year"
);
$stmt->execute([$client_id, $entity]);
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

// ── Pivot: metric_key → { year: value } ──────────────────────────────────────
$pivot = [];
foreach ($rows as $row) {
    $key  = $row['metric_key'];
    $year = $row['year'];
    $val  = $row['metric_value'] !== null ? (float)$row['metric_value'] : null;
    if (!isset($pivot[$key])) $pivot[$key] = [];
    $pivot[$key][$year] = $val;
}

// ── Build response ────────────────────────────────────────────────────────────
$result = [];
foreach ($pivot as $key => $series) {
    $result[] = ['metric_key' => $key, 'series' => $series];
}

echo json_encode(['entity' => $entity, 'rows' => $result]);
