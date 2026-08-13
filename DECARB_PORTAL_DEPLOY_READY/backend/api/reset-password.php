<?php
declare(strict_types=1);
require __DIR__ . '/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    dolphin_send_json(['error' => 'POST only'], 405);
}

$body = dolphin_json_body();
$token = $body['token'] ?? '';
$newPassword = $body['newPassword'] ?? '';

if ($token === '' || strlen($newPassword) < 8) {
    dolphin_send_json(['error' => 'Token and a new password (8+ characters) are required'], 400);
}

$pdo = dolphin_db();
$stmt = $pdo->prepare(
    'SELECT id, user_id FROM password_resets WHERE token = ? AND used = 0 AND expires_at > NOW()'
);
$stmt->execute([$token]);
$reset = $stmt->fetch();

if (!$reset) {
    dolphin_send_json(['error' => 'This reset link is invalid or has expired — request a new one.'], 400);
}

$pdo->beginTransaction();
$pdo->prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?')
    ->execute([password_hash($newPassword, PASSWORD_BCRYPT), $reset['user_id']]);
$pdo->prepare('UPDATE password_resets SET used = 1 WHERE id = ?')->execute([$reset['id']]);
// Invalidate any existing sessions so old logged-in devices need the new password too.
$pdo->prepare('DELETE FROM sessions WHERE user_id = ?')->execute([$reset['user_id']]);
$pdo->commit();

dolphin_send_json(['ok' => true]);
