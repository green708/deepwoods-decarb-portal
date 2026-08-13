<?php
// datasets.php

require_once __DIR__ . '/db.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$user      = dolphin_require_auth();
dolphin_require_active_client($user);
dolphin_require_payment($user);
$client_id = (int)($user['client_id'] ?? 0);
if (!$client_id) { echo json_encode([]); exit; }

$stmt = $pdo->prepare(
    "SELECT dataset_id AS id, name, description, submission_type AS type, template_url, enabled
     FROM datasets WHERE client_id = ? AND enabled = 1 ORDER BY sort_order"
);
$stmt->execute([$client_id]);
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
foreach ($rows as &$r) { $r['enabled'] = (bool)$r['enabled']; }
echo json_encode($rows);
