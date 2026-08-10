<?php
// methodology.php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth_middleware.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$user      = requireAuth();
$client_id = (int)$user['client_id'];

$stmt = $pdo->prepare(
    "SELECT section, content, sort_order FROM methodology WHERE client_id = ? ORDER BY sort_order"
);
$stmt->execute([$client_id]);
echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
