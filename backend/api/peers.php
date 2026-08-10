<?php
// peers.php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth_middleware.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$user      = requireAuth();
$client_id = (int)$user['client_id'];

$stmt = $pdo->prepare(
    "SELECT p.name, pt.fy, pt.scope1, pt.scope2_lb, pt.scope2_mb, pt.scope3_total, pt.intensity_revenue
     FROM peers p JOIN peer_trends pt ON pt.peer_id = p.id
     WHERE p.client_id = ? ORDER BY p.name, pt.fy"
);
$stmt->execute([$client_id]);
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
foreach ($rows as &$r) {
    foreach (['scope1','scope2_lb','scope2_mb','scope3_total','intensity_revenue'] as $k) {
        $r[$k] = $r[$k] !== null ? (float)$r[$k] : null;
    }
}
echo json_encode($rows);
