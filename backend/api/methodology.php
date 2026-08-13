<?php
// methodology.php

require_once __DIR__ . '/db.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$user      = dolphin_require_auth();
dolphin_require_active_client($user);
$client_id = (int)($user['client_id'] ?? 0);
if (!$client_id) { echo json_encode([]); exit; }

$stmt = $pdo->prepare(
    "SELECT section, content, sort_order FROM methodology WHERE client_id = ? ORDER BY sort_order"
);
$stmt->execute([$client_id]);
echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
