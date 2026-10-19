<?php
// environmental-data.php
// GET  → load saved environmental data (water, waste, denominators) for the client+fy
// POST → save a specific type { type, fy, ...data }

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
    $fy    = $_GET['fy'] ?? null;
    $types = ['water', 'waste', 'denominators'];
    $result = [];
    foreach ($types as $type) {
        $key = "env_{$type}" . ($fy ? "_{$fy}" : '');
        $stmt = $pdo->prepare(
            "SELECT config_value FROM client_config WHERE client_id = ? AND config_key = ?"
        );
        $stmt->execute([$client_id, $key]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        $result[$type] = $row ? json_decode($row['config_value'], true) : null;
    }
    dolphin_send_json($result);

} elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = dolphin_json_body();
    if (!is_array($body) || empty($body['type'])) {
        dolphin_send_json(['error' => 'Invalid body — type required'], 400);
    }
    $type = preg_replace('/[^a-z_]/', '', strtolower($body['type']));
    $fy   = isset($body['fy']) ? preg_replace('/[^a-zA-Z0-9\-_]/', '', (string)$body['fy']) : '';
    $key  = "env_{$type}" . ($fy ? "_{$fy}" : '');
    $json = json_encode($body);
    $stmt = $pdo->prepare(
        "INSERT INTO client_config (client_id, config_key, config_value)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)"
    );
    $stmt->execute([$client_id, $key, $json]);
    dolphin_send_json(['ok' => true]);

} else {
    dolphin_send_json(['error' => 'Method not allowed'], 405);
}
