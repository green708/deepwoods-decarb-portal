<?php
// ghg/s1.php — GET /backend/api/ghg/s1.php?entity=FP&view=breakdown|by_facility

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
$view      = $_GET['view']   ?? 'breakdown';

if ($view === 'breakdown') {
    $stmt = $pdo->prepare(
        "SELECT source_type AS source, fuel_type AS fuel, year, tco2e
         FROM s1_breakdown
         WHERE client_id = ? AND entity = ?
         ORDER BY source_type, fuel_type, year"
    );
    $stmt->execute([$client_id, $entity]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Pivot by source+fuel → series
    $pivot = [];
    foreach ($rows as $row) {
        $k = $row['source'] . '||' . $row['fuel'];
        if (!isset($pivot[$k])) $pivot[$k] = ['source' => $row['source'], 'fuel' => $row['fuel'], 'series' => []];
        $pivot[$k]['series'][$row['year']] = $row['tco2e'] !== null ? (float)$row['tco2e'] : null;
    }
    echo json_encode(array_values($pivot));

} else {
    // by_facility
    $stmt = $pdo->prepare(
        "SELECT facility, sub_type, year, tco2e
         FROM s1_by_facility
         WHERE client_id = ? AND entity = ?
         ORDER BY facility, year"
    );
    $stmt->execute([$client_id, $entity]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $pivot = [];
    foreach ($rows as $row) {
        $k = $row['facility'] . '||' . $row['sub_type'];
        if (!isset($pivot[$k])) $pivot[$k] = ['facility' => $row['facility'], 'sub_type' => $row['sub_type'], 'series' => []];
        $pivot[$k]['series'][$row['year']] = $row['tco2e'] !== null ? (float)$row['tco2e'] : null;
    }
    echo json_encode(array_values($pivot));
}
