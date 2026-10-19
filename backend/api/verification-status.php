<?php
// verification-status.php
// GET  → load verification/assurance records for the logged-in user's client
// POST → { records: [...] } — full replace (array of VerificationRecord objects)

declare(strict_types=1);
require_once __DIR__ . '/db.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$user = dolphin_require_auth();
$pdo  = dolphin_db();
$isStaff = in_array($user['role'] ?? '', ['deepwoods_admin', 'deepwoods_coordinator'], true);

// Deepwoods admins work org-wide; client users read their own records.
// We key by client_id from the token (null for Deepwoods staff → use query param).
// Staff name the client explicitly (query string); only fall back to a view-as client when they do not.
$client_id = $isStaff
    ? (isset($_GET['client_id']) ? (int)$_GET['client_id'] : (int)($user['client_id'] ?? 0))
    : (int)($user['client_id'] ?? 0);

if (!$client_id) {
    dolphin_send_json(['error' => 'client_id required'], 400);
}

$config_key = 'verification_records';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $pdo->prepare(
        "SELECT config_value FROM client_config WHERE client_id = ? AND config_key = ?"
    );
    $stmt->execute([$client_id, $config_key]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    $records = $row ? json_decode($row['config_value'], true) : [];
    dolphin_send_json(['records' => $records ?? []]);

} elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!$isStaff) {
        dolphin_send_json(['error' => 'Only Deepwoods staff can record verification status'], 403);
    }
    $body = dolphin_json_body();
    if (isset($body['client_id']) && !isset($_GET['client_id'])) { $client_id = (int)$body['client_id']; }
    if (!$client_id) { dolphin_send_json(['error' => 'client_id required'], 400); }
    $exists = $pdo->prepare('SELECT 1 FROM clients WHERE id = ?');
    $exists->execute([$client_id]);
    if (!$exists->fetchColumn()) { dolphin_send_json(['error' => 'Client not found'], 404); }
    if (!is_array($body) || !isset($body['records']) || !is_array($body['records'])) {
        dolphin_send_json(['error' => 'Invalid body — records array required'], 400);
    }
    $json = json_encode($body['records']);
    $stmt = $pdo->prepare(
        "INSERT INTO client_config (client_id, config_key, config_value)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)"
    );
    $stmt->execute([$client_id, $config_key, $json]);
    dolphin_send_json(['ok' => true]);

} else {
    dolphin_send_json(['error' => 'Method not allowed'], 405);
}
