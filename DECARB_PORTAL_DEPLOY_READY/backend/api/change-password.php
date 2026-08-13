<?php
declare(strict_types=1);
require __DIR__ . '/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    dolphin_send_json(['error' => 'POST only'], 405);
}

$user = dolphin_require_auth();
$body = dolphin_json_body();
$current = $body['currentPassword'] ?? '';
$new = $body['newPassword'] ?? '';

if (strlen($new) < 8) {
    dolphin_send_json(['error' => 'New password must be at least 8 characters'], 400);
}

$pdo = dolphin_db();
$stmt = $pdo->prepare('SELECT password_hash FROM users WHERE id = ?');
$stmt->execute([$user['id']]);
$row = $stmt->fetch();

if (!password_verify($current, $row['password_hash'])) {
    dolphin_send_json(['error' => 'Current password is incorrect'], 401);
}

$pdo->prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?')
    ->execute([password_hash($new, PASSWORD_BCRYPT), $user['id']]);

dolphin_send_json(['ok' => true]);
