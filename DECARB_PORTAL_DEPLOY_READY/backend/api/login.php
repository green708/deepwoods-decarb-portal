<?php
declare(strict_types=1);
require __DIR__ . '/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    dolphin_send_json(['error' => 'POST only'], 405);
}

$body = dolphin_json_body();
$email    = trim(strtolower($body['email'] ?? ''));
$password = $body['password'] ?? '';

if ($email === '' || $password === '') {
    dolphin_send_json(['error' => 'Email and password are required'], 400);
}

$pdo = dolphin_db();
$stmt = $pdo->prepare(
    'SELECT id, email, password_hash, role, must_change_password, client_id
     FROM users WHERE email = ?'
);
$stmt->execute([$email]);
$user = $stmt->fetch();

// Generic error — don't reveal whether email or password was wrong
if (!$user || !password_verify($password, $user['password_hash'])) {
    dolphin_send_json(['error' => 'Invalid email or password'], 401);
}

$token   = dolphin_generate_token();
$expires = (new DateTime('+7 days'))->format('Y-m-d H:i:s');
$pdo->prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)')
    ->execute([$token, $user['id'], $expires]);

dolphin_send_json([
    'token'              => $token,
    'email'              => $user['email'],
    'role'               => $user['role'],
    'client_id'          => (int)$user['client_id'],
    'mustChangePassword' => (bool)$user['must_change_password'],
]);
