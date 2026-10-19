<?php
// scope3-questionnaire.php
// GET  — load client's Scope 3 questionnaire (15 yes/no/unsure/null elements)
// POST — save client's answers
//
// All portal roles may GET/POST for their own client.
// Admins may GET with ?client_id=X to see a specific client's answers.

declare(strict_types=1);
require_once __DIR__ . '/db.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$user   = dolphin_require_auth();
$role   = $user['role'] ?? '';
$isAdmin = in_array($role, ['deepwoods_admin', 'deepwoods_coordinator'], true);

// ── GET ───────────────────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if ($isAdmin) {
        $clientId = (int)($_GET['client_id'] ?? 0);
        if (!$clientId) { dolphin_send_json(['error' => 'client_id required for admin'], 400); }
    } else {
        $clientId = (int)($user['client_id'] ?? 0);
        if (!$clientId) { dolphin_send_json(['error' => 'Forbidden'], 403); }
    }
    $pdo  = dolphin_db();
    $stmt = $pdo->prepare("SELECT config_value FROM client_config WHERE client_id = ? AND config_key = 's3_questionnaire'");
    $stmt->execute([$clientId]);
    $raw  = $stmt->fetchColumn();
    dolphin_send_json(['questionnaire' => $raw ? json_decode($raw, true) : null]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    dolphin_send_json(['error' => 'GET or POST only'], 405);
}

// ── POST ──────────────────────────────────────────────────────────────────────
$body          = dolphin_json_body();
$questionnaire = $body['questionnaire'] ?? null;

if ($isAdmin) {
    $clientId = (int)($body['client_id'] ?? 0);
    if (!$clientId) { dolphin_send_json(['error' => 'client_id required for admin'], 400); }
} else {
    $clientId = (int)($user['client_id'] ?? 0);
    if (!$clientId) { dolphin_send_json(['error' => 'Forbidden'], 403); }
}

if (!is_array($questionnaire) || count($questionnaire) < 15) {
    dolphin_send_json(['error' => '15-element questionnaire array required'], 400);
}

$pdo = dolphin_db();
$pdo->prepare(
    'INSERT INTO client_config (client_id, config_key, config_value)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)'
)->execute([$clientId, 's3_questionnaire', json_encode(array_slice($questionnaire, 0, 15))]);

dolphin_send_json(['ok' => true]);
