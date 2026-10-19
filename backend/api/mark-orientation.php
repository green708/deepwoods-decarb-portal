<?php
// mark-orientation.php — POST: records that the signed-in user finished the orientation tour.
declare(strict_types=1);
require __DIR__ . '/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    dolphin_send_json(['error' => 'POST only'], 405);
}

$user = dolphin_require_auth();
try {
    dolphin_db()->prepare('UPDATE users SET orientation_done = 1 WHERE id = ?')->execute([$user['id']]);
} catch (PDOException $e) {
    // column missing on a DB that hasn't run migration 009 — browser flag still applies
}
dolphin_send_json(['ok' => true]);
