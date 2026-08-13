<?php
declare(strict_types=1);
require __DIR__ . '/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    dolphin_send_json(['error' => 'POST only'], 405);
}

$headers = getallheaders();
$authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
if (preg_match('/^Bearer\s+(.+)$/i', $authHeader, $m)) {
    dolphin_db()->prepare('DELETE FROM sessions WHERE token = ?')->execute([$m[1]]);
}

dolphin_send_json(['ok' => true]);
