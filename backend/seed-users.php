<?php
declare(strict_types=1);
// One-time script — visit this once in a browser after running schema.sql
// AND after running database/migrations/001_migrate_legacy_roles.sql.
// Creates the real Featherlite accounts with their client_id set.
// Each account's initial password is their own email address.
//
// IMPORTANT: Delete this file from the server immediately after running it.

require __DIR__ . '/api/db.php';

header('Content-Type: text/plain');

$pdo = dolphin_db();

// Look up the Featherlite client id — created by schema_combined.sql
$stmt = $pdo->prepare('SELECT id FROM clients WHERE slug = ?');
$stmt->execute(['featherlite']);
$featherlite = $stmt->fetch();
if (!$featherlite) {
    die("ERROR: 'featherlite' client row not found. Run schema_combined.sql first.\n");
}
$featherliteId = (int)$featherlite['id'];

$accounts = [
    // Featherlite client accounts — tied to client_id
    ['email' => 'featherlite.sustainability@featherlite.com', 'role' => 'sustainability_team', 'client_id' => $featherliteId],
    ['email' => 'featherlite.leadership@featherlite.com',     'role' => 'client_leadership',   'client_id' => $featherliteId],
    // Deepwoods platform accounts — not tied to any specific client
    ['email' => 'deepwoods.likhith@gmail.com',                'role' => 'deepwoods_admin',       'client_id' => null],
    ['email' => 'we@deepwoodsgreen.com',                      'role' => 'deepwoods_coordinator', 'client_id' => null],
];

$stmt = $pdo->prepare(
    'INSERT INTO users (email, password_hash, role, client_id, must_change_password) VALUES (?, ?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE role = VALUES(role), client_id = VALUES(client_id)'
);

foreach ($accounts as $a) {
    $hash = password_hash($a['email'], PASSWORD_BCRYPT);
    $stmt->execute([$a['email'], $hash, $a['role'], $a['client_id']]);
    $clientNote = $a['client_id'] ? " [client_id={$a['client_id']}]" : ' [Deepwoods]';
    echo "Created/updated: {$a['email']} ({$a['role']}){$clientNote}\n";
}

echo "\nDone. Each user should log in with their email as both username and password,\n";
echo "then change it — the app will force this on first login.\n";
echo "\nDelete this file (seed-users.php) from the server now.\n";
