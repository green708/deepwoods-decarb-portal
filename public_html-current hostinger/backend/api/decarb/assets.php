<?php
// decarb/assets.php — GET /backend/api/decarb/assets.php[?entity=FP]

require_once __DIR__ . '/../db.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$user      = dolphin_require_auth();
dolphin_require_active_client($user);
dolphin_require_payment($user);
$client_id = (int)$user['client_id'];
$entity    = dolphin_validate_entity($user, trim($_GET['entity'] ?? '')) ?: null;

// Look up consolidated entity code (replaces hardcoded 'FL')
$consStmt = $pdo->prepare('SELECT code FROM client_entities WHERE client_id = ? AND is_consolidated = 1 LIMIT 1');
$consStmt->execute([$client_id]);
$consolidatedCode = $consStmt->fetchColumn() ?: null;

$sql = "SELECT a.asset_id AS id, a.entity, a.name, a.facility, a.fuel_type AS fuel,
               a.scope, a.sub_type, a.status, a.health, a.unit
        FROM decarb_assets a WHERE a.client_id = ?";
$params = [$client_id];
if ($entity && (!$consolidatedCode || $entity !== $consolidatedCode)) {
    $sql .= " AND a.entity = ?"; $params[] = $entity;
}

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$assets = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Fetch series data for each asset
$ids = array_column($assets, 'id');
$series = [];
if ($ids) {
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $stmt2 = $pdo->prepare(
        "SELECT asset_id, year, tco2e FROM s1_equipment WHERE client_id = ? AND asset_id IN ($placeholders) ORDER BY year"
    );
    $stmt2->execute(array_merge([$client_id], $ids));
    foreach ($stmt2->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $series[$row['asset_id']][$row['year']] = (float)$row['tco2e'];
    }
}
foreach ($assets as &$a) {
    $a['series'] = $series[$a['id']] ?? [];
}

echo json_encode($assets);
