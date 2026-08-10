<?php
// datasets.php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth_middleware.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$user      = requireAuth();
$client_id = (int)$user['client_id'];

$stmt = $pdo->prepare(
    "SELECT dataset_id AS id, name, description, submission_type AS type, template_url, enabled
     FROM datasets WHERE client_id = ? AND enabled = 1 ORDER BY sort_order"
);
$stmt->execute([$client_id]);
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
foreach ($rows as &$r) { $r['enabled'] = (bool)$r['enabled']; }
echo json_encode($rows);
