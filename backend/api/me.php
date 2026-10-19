<?php
declare(strict_types=1);
require __DIR__ . '/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    dolphin_send_json(['error' => 'GET only'], 405);
}

$user = dolphin_require_auth();
$orientationDone = false;
try {
    $st = dolphin_db()->prepare('SELECT orientation_done FROM users WHERE id = ?');
    $st->execute([$user['id']]);
    $orientationDone = (bool) $st->fetchColumn();
} catch (PDOException $e) {
    // migration 009 not applied yet
}
$displayName = null;
try {
    $st = dolphin_db()->prepare('SELECT display_name FROM users WHERE id = ?');
    $st->execute([$user['id']]);
    $displayName = $st->fetchColumn() ?: null;
} catch (PDOException $e) {
    // migration 010 not applied yet
}
dolphin_send_json([
    'orientationDone' => $orientationDone,
    'email' => $user['email'],
    'role' => $user['role'],
    'mustChangePassword' => (bool) $user['must_change_password'],
    'display_name' => $displayName,
    'user' => [
        'email' => $user['email'],
        'role' => $user['role'],
        'entity_scope' => $user['entity_scope'] ?? null,
        'display_name' => $displayName,
    ],
]);
