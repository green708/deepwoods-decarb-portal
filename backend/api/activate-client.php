<?php
// activate-client.php — GET / POST / PATCH /backend/api/activate-client.php
// Deepwoods admin only: list clients and activate/deactivate them.
//
// GET                                          → list all clients with activation + invoice status
// POST { client_id, active: true|false }       → set is_active flag (and activated_at)
// PATCH { client_id, invoice_ref?, payment_status?, payment_date?, payment_notes? }
//                                              → update invoice / payment fields

declare(strict_types=1);
require_once __DIR__ . '/db.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Allow-Methods: GET, POST, PATCH, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$authUser = dolphin_require_auth();
if ($authUser['role'] !== 'deepwoods_admin') {
    dolphin_send_json(['error' => 'deepwoods_admin role required'], 403);
}

$pdo    = dolphin_db();
$method = $_SERVER['REQUEST_METHOD'];

// ── GET — list all clients ────────────────────────────────────────────────────

if ($method === 'GET') {
    $stmt = $pdo->query(
        "SELECT c.id, c.name, c.slug, c.is_active, c.activated_at, c.created_at,
                c.invoice_ref, c.payment_status, c.payment_date, c.payment_notes,
                (SELECT COUNT(*) FROM users u WHERE u.client_id = c.id) AS user_count,
                (SELECT cc.config_value FROM client_config cc
                 WHERE cc.client_id = c.id AND cc.config_key = 'setup_complete') AS setup_complete,
                (SELECT cc2.config_value FROM client_config cc2
                 WHERE cc2.client_id = c.id AND cc2.config_key = 'ghg_setup_done') AS ghg_setup_done
         FROM clients c
         ORDER BY c.created_at DESC"
    );
    $rows = $stmt->fetchAll();
    foreach ($rows as &$r) {
        $r['id']         = (int)$r['id'];
        $r['is_active']  = (bool)$r['is_active'];
        $r['user_count'] = (int)$r['user_count'];
    }
    unset($r);
    dolphin_send_json($rows);
}

// ── POST — activate or deactivate a client ────────────────────────────────────

if ($method === 'POST') {
    $body     = dolphin_json_body();
    $clientId = isset($body['client_id']) ? (int)$body['client_id'] : 0;
    $activate = isset($body['active']) ? (bool)$body['active'] : true;

    if (!$clientId) {
        dolphin_send_json(['error' => 'client_id is required'], 400);
    }

    $stmt = $pdo->prepare('SELECT id, name FROM clients WHERE id = ?');
    $stmt->execute([$clientId]);
    $client = $stmt->fetch();
    if (!$client) {
        dolphin_send_json(['error' => 'Client not found'], 404);
    }

    if ($activate) {
        $pdo->prepare(
            'UPDATE clients SET is_active = 1, activated_at = NOW() WHERE id = ?'
        )->execute([$clientId]);
    } else {
        $pdo->prepare(
            'UPDATE clients SET is_active = 0 WHERE id = ?'
        )->execute([$clientId]);
    }

    dolphin_send_json([
        'ok'        => true,
        'client_id' => $clientId,
        'is_active' => $activate,
        'name'      => $client['name'],
    ]);
}

// ── PATCH — update invoice / payment fields ───────────────────────────────────

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

    $allowed = ['invoice_ref', 'payment_status', 'payment_date', 'payment_notes'];
    $validStatuses = ['pending', 'paid', 'waived'];

    $setClauses = [];
    $params     = [];

    foreach ($allowed as $field) {
        if (!array_key_exists($field, $body)) continue;

        $val = $body[$field];

        if ($field === 'payment_status') {
            if (!in_array($val, $validStatuses, true)) {
                dolphin_send_json(['error' => "payment_status must be one of: " . implode(', ', $validStatuses)], 400);
            }
        }

        if ($field === 'payment_date' && $val !== null) {
            // Accept YYYY-MM-DD only
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)$val)) {
                dolphin_send_json(['error' => 'payment_date must be YYYY-MM-DD or null'], 400);
            }
        }

        $setClauses[] = "`{$field}` = ?";
        $params[]     = ($val === '' || $val === null) ? null : $val;
    }

    if (empty($setClauses)) {
        dolphin_send_json(['error' => 'No valid fields to update'], 400);
    }

    $params[] = $clientId;
    $pdo->prepare("UPDATE clients SET " . implode(', ', $setClauses) . " WHERE id = ?")->execute($params);

    dolphin_send_json(['ok' => true, 'client_id' => $clientId]);
}

dolphin_send_json(['error' => 'GET, POST, or PATCH only'], 405);
