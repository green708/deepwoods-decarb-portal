<?php
// reporting-boundary.php
// GET  → load saved reporting boundary config for the client
// POST → save reporting boundary config { ...boundaryData }

declare(strict_types=1);
require_once __DIR__ . '/db.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$user = dolphin_require_auth();
dolphin_block_read_only_writes($user);
if (!isset($user['client_id']) || !$user['client_id']) {
    dolphin_send_json(['error' => 'No client context'], 403);
}
$client_id = (int)$user['client_id'];
$pdo = dolphin_db();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $pdo->prepare(
        "SELECT config_value FROM client_config WHERE client_id = ? AND config_key = 'reporting_boundary'"
    );
    $stmt->execute([$client_id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    dolphin_send_json(['reporting_boundary' => $row ? json_decode($row['config_value'], true) : null]);

} elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = dolphin_json_body();
    if (!is_array($body)) {
        dolphin_send_json(['error' => 'Invalid JSON body'], 400);
    }
    $json = json_encode($body);
    $stmt = $pdo->prepare(
        "INSERT INTO client_config (client_id, config_key, config_value)
         VALUES (?, 'reporting_boundary', ?)
         ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)"
    );
    $stmt->execute([$client_id, $json]);
    dolphin_send_json(['ok' => true]);

} else {
    dolphin_send_json(['error' => 'Method not allowed'], 405);
}
