<?php
declare(strict_types=1);
require __DIR__ . '/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    dolphin_send_json(['error' => 'GET only'], 405);
}

$user = dolphin_require_auth();
dolphin_send_json([
    'email' => $user['email'],
    'role' => $user['role'],
    'mustChangePassword' => (bool) $user['must_change_password'],
]);
