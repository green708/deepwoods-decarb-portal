<?php
declare(strict_types=1);
require __DIR__ . '/db.php';

// Admin-only: list all accounts, or create a new one. New accounts start
// with password = their own email and must_change_password = 1, same as
// the initial seeded accounts.

$user = dolphin_require_auth();
if ($user['role'] !== 'deepwoods_admin') {
    dolphin_send_json(['error' => 'Admin only'], 403);
}

$pdo = dolphin_db();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Optional: filter by client_id when deepwoods_admin is managing a specific client
    $clientId = isset($_GET['client_id']) ? (int)$_GET['client_id'] : null;

    if ($clientId !== null) {
        $stmt = $pdo->prepare(
            'SELECT id, email, role, client_id, must_change_password, created_at
             FROM users WHERE client_id = ? ORDER BY created_at DESC'
        );
        $stmt->execute([$clientId]);
    } else {
        $stmt = $pdo->query(
            'SELECT id, email, role, client_id, must_change_password, created_at
             FROM users ORDER BY created_at DESC'
        );
    }
    dolphin_send_json($stmt->fetchAll());
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body      = dolphin_json_body();
    $email     = trim(strtolower($body['email'] ?? ''));
    $role      = $body['role'] ?? '';
    $clientId  = isset($body['client_id']) ? (int)$body['client_id'] : null;
    $entityScope = isset($body['entity_scope']) ? trim($body['entity_scope']) : null;

    $validRoles = [
        'sustainability_team',
        'client_uploader',
        'client_leadership',
        'deepwoods_admin',
        'deepwoods_coordinator',
    ];

    if ($email === '' || !in_array($role, $validRoles, true)) {
        dolphin_send_json(['error' => 'A valid email and role are required'], 400);
    }

    // Client roles must be tied to a client; Deepwoods roles must not be.
    $clientRoles  = ['sustainability_team', 'client_uploader', 'client_leadership'];
    $isClientRole = in_array($role, $clientRoles, true);

    if ($isClientRole && $clientId === null) {
        dolphin_send_json(['error' => 'client_id is required for client roles'], 400);
    }
    if (!$isClientRole && $clientId !== null) {
        dolphin_send_json(['error' => 'client_id must not be set for Deepwoods roles'], 400);
    }

    // Verify the client_id actually exists
    if ($clientId !== null) {
        $check = $pdo->prepare('SELECT id FROM clients WHERE id = ?');
        $check->execute([$clientId]);
        if (!$check->fetch()) {
            dolphin_send_json(['error' => 'client_id does not exist'], 404);
        }
    }

    try {
        $pdo->prepare(
            'INSERT INTO users (email, password_hash, role, client_id, entity_scope, must_change_password)
             VALUES (?, ?, ?, ?, ?, 1)'
        )->execute([
            $email,
            password_hash($email, PASSWORD_BCRYPT),
            $role,
            $clientId,
            $entityScope ?: null,
        ]);
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') {
            dolphin_send_json(['error' => 'An account with that email already exists'], 409);
        }
        throw $e;
    }

    dolphin_send_json([
        'ok'              => true,
        'email'           => $email,
        'role'            => $role,
        'client_id'       => $clientId,
        'initialPassword' => $email,
    ]);
}

dolphin_send_json(['error' => 'GET or POST only'], 405);
