<?php
// branding.php — GET / PATCH /backend/api/branding.php
// Deepwoods admin only: read and update logo_url + primary_color per client.
//
// GET  ?client_id=N                     → { logo_url, primary_color }
// PATCH { client_id, logo_url?, primary_color? } → update clients row

declare(strict_types=1);
require_once __DIR__ . '/db.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Allow-Methods: GET, PATCH, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$authUser = dolphin_require_auth();
if ($authUser['role'] !== 'deepwoods_admin') {
    dolphin_send_json(['error' => 'deepwoods_admin role required'], 403);
}

$pdo    = dolphin_db();
$method = $_SERVER['REQUEST_METHOD'];

// ── GET — fetch current branding for one client ───────────────────────────────

if ($method === 'GET') {
    $clientId = isset($_GET['client_id']) ? (int)$_GET['client_id'] : 0;
    if (!$clientId) {
        dolphin_send_json(['error' => 'client_id required'], 400);
    }
    $stmt = $pdo->prepare('SELECT logo_url, primary_color FROM clients WHERE id = ?');
    $stmt->execute([$clientId]);
    $row = $stmt->fetch();
    if (!$row) {
        dolphin_send_json(['error' => 'Client not found'], 404);
    }
    dolphin_send_json([
        'logo_url'      => $row['logo_url']      ?? null,
        'primary_color' => $row['primary_color'] ?? '#1E6F5C',
    ]);
}

// ── PATCH — update branding ───────────────────────────────────────────────────

if ($method === 'PATCH') {
    $body     = dolphin_json_body();
    $clientId = isset($body['client_id']) ? (int)$body['client_id'] : 0;

    if (!$clientId) {
        dolphin_send_json(['error' => 'client_id is required'], 400);
    }

    $stmt = $pdo->prepare('SELECT id FROM clients WHERE id = ?');
    $stmt->execute([$clientId]);
    if (!$stmt->fetch()) {
        dolphin_send_json(['error' => 'Client not found'], 404);
    }

    $sets   = [];
    $params = [];

    if (array_key_exists('logo_url', $body)) {
        $sets[]   = 'logo_url = ?';
        $params[] = $body['logo_url'] ?: null;
    }

    if (array_key_exists('primary_color', $body)) {
        $color = trim($body['primary_color'] ?? '');
        if ($color !== '' && !preg_match('/^#[0-9A-Fa-f]{3,8}$/', $color)) {
            dolphin_send_json(['error' => 'primary_color must be a valid hex colour (#rrggbb)'], 400);
        }
        $sets[]   = 'primary_color = ?';
        $params[] = $color ?: null;
    }

    if (empty($sets)) {
        dolphin_send_json(['error' => 'No valid fields to update'], 400);
    }

    $params[] = $clientId;
    $pdo->prepare('UPDATE clients SET ' . implode(', ', $sets) . ' WHERE id = ?')
        ->execute($params);

    dolphin_send_json(['ok' => true, 'client_id' => $clientId]);
}

dolphin_send_json(['error' => 'GET or PATCH only'], 405);
