<?php
// ghg/s2.php — GET /backend/api/ghg/s2.php?entity=FP&view=breakdown|by_facility

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
$view      = $_GET['view']   ?? 'breakdown';

if ($view === 'breakdown') {
    $stmt = $pdo->prepare(
        "SELECT breakdown_type AS type, year,
                grid_kwh, re_kwh, tco2e_lb, tco2e_mb
         FROM s2_breakdown
         WHERE client_id = ? AND entity = ?
         ORDER BY year"
    );
    $stmt->execute([$client_id, $entity]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Build typed series
    $lb = []; $mb = []; $grid = []; $re = [];
    foreach ($rows as $row) {
        $y = $row['year'];
        $lb[$y]   = $row['tco2e_lb']  !== null ? (float)$row['tco2e_lb']  : null;
        $mb[$y]   = $row['tco2e_mb']  !== null ? (float)$row['tco2e_mb']  : null;
        $grid[$y] = $row['grid_kwh']  !== null ? (float)$row['grid_kwh']  : null;
        $re[$y]   = $row['re_kwh']    !== null ? (float)$row['re_kwh']    : null;
    }
    echo json_encode([
        ['type' => 'location_based', 'series' => $lb],
        ['type' => 'market_based',   'series' => $mb],
        ['type' => 'grid_kwh',       'series' => $grid],
        ['type' => 're_kwh',         'series' => $re],
    ]);

} else {
    $stmt = $pdo->prepare(
        "SELECT facility, year, tco2e_lb
         FROM s2_by_facility
         WHERE client_id = ? AND entity = ?
         ORDER BY facility, year"
    );
    $stmt->execute([$client_id, $entity]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $pivot = [];
    foreach ($rows as $row) {
        $k = $row['facility'];
        if (!isset($pivot[$k])) $pivot[$k] = ['facility' => $k, 'series' => []];
        $pivot[$k]['series'][$row['year']] = $row['tco2e_lb'] !== null ? (float)$row['tco2e_lb'] : null;
    }
    echo json_encode(array_values($pivot));
}
