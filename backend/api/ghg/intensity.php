<?php
// ghg/intensity.php — GET /backend/api/ghg/intensity.php?entity=FL

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

$stmt = $pdo->prepare(
    "SELECT year AS fy, revenue_lakh, production_units, s12_lb, s12_mb, s3_total
     FROM intensity_metrics
     WHERE client_id = ? AND entity = ?
     ORDER BY year"
);
$stmt->execute([$client_id, $entity]);
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

foreach ($rows as &$row) {
    $row['revenue_lakh']      = $row['revenue_lakh']      !== null ? (float)$row['revenue_lakh']      : null;
    $row['production_units']  = $row['production_units']  !== null ? (float)$row['production_units']  : null;
    $row['s12_lb']            = $row['s12_lb']            !== null ? (float)$row['s12_lb']            : null;
    $row['s12_mb']            = $row['s12_mb']            !== null ? (float)$row['s12_mb']            : null;
    $row['s3_total']          = $row['s3_total']          !== null ? (float)$row['s3_total']          : null;
}

echo json_encode($rows);
