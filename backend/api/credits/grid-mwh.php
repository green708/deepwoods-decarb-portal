<?php
// credits/grid-mwh.php — GET /backend/api/credits/grid-mwh.php[?entity=FP]

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

// Determine the consolidated entity code for this client (DB-driven, not hardcoded)
$consStmt = $pdo->prepare('SELECT code FROM client_entities WHERE client_id = ? AND is_consolidated = 1 LIMIT 1');
$consStmt->execute([$client_id]);
$consolidatedCode = $consStmt->fetchColumn() ?: null;

// Returns: { "FP": { "FY22": 96.0, ... }, "FOS": { ... } }
$gmSql = "SELECT entity, year, grid_mwh FROM grid_mwh_history WHERE client_id = ?";
$gmParams = [$client_id];
// Filter by entity only if it's not the consolidated entity (which represents all)
if ($entity && (!$consolidatedCode || $entity !== $consolidatedCode)) {
    $gmSql .= " AND entity = ?"; $gmParams[] = $entity;
}
$gmSql .= " ORDER BY entity, year";
$stmt = $pdo->prepare($gmSql);
$stmt->execute($gmParams);
$result = [];
foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
    $result[$row['entity']][$row['year']] = (float)$row['grid_mwh'];
}
echo json_encode($result);
