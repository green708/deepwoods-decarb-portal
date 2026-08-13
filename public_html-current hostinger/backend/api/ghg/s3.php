<?php
// ghg/s3.php — GET /backend/api/ghg/s3.php?entity=FL

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_middleware.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$user      = dolphin_require_auth();
dolphin_require_active_client($user);
dolphin_require_payment($user);
if (empty($user['client_id'])) { echo json_encode([]); exit; }
$client_id = (int)$user['client_id'];
$entity    = dolphin_validate_entity($user, trim($_GET['entity'] ?? ''));

$stmt = $pdo->prepare(
    "SELECT entity, category, year, tco2e
     FROM scope3_summary
     WHERE client_id = ? AND entity = ?
     ORDER BY category, year"
);
$stmt->execute([$client_id, $entity]);
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Pivot: category → { entity, category, series }
$pivot = [];
foreach ($rows as $row) {
    $k = $row['category'];
    if (!isset($pivot[$k])) $pivot[$k] = ['entity' => $row['entity'], 'category' => $k, 'series' => []];
    $pivot[$k]['series'][$row['year']] = $row['tco2e'] !== null ? (float)$row['tco2e'] : null;
}
echo json_encode(array_values($pivot));
