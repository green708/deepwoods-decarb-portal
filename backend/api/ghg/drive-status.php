<?php
declare(strict_types=1);
// Returns Drive connection status for a client.
// Admin: pass ?client_id=X to check any client.
// Admin: pass ?all=1 to get status for all clients (id, name, connected, has_folder).
require __DIR__ . '/../db.php';

$authUser = dolphin_require_auth();
$pdo      = dolphin_db();

$isAdmin = in_array($authUser['role'], ['deepwoods_admin', 'deepwoods_coordinator'], true);

if ($isAdmin && !empty($_GET['all'])) {
    // Return all clients' Drive status for the admin Drive Settings tab
    $stmt = $pdo->query(
        'SELECT id, name, slug, drive_root_folder_id, drive_refresh_token FROM clients ORDER BY name'
    );
    $rows = $stmt->fetchAll();
    dolphin_send_json(array_map(fn($r) => [
        'id'         => (int)$r['id'],
        'name'       => $r['name'],
        'slug'       => $r['slug'],
        'connected'  => !empty($r['drive_refresh_token']),
        'has_folder' => !empty($r['drive_root_folder_id']),
        'folder_id'  => $r['drive_root_folder_id'] ?? null,
    ], $rows));
}

// Single-client lookup
if ($isAdmin && !empty($_GET['client_id'])) {
    $clientId = (int)$_GET['client_id'];
} else {
    dolphin_require_active_client($authUser);
    $clientId = (int)$authUser['client_id'];
}

$stmt = $pdo->prepare('SELECT drive_root_folder_id, drive_refresh_token FROM clients WHERE id = ?');
$stmt->execute([$clientId]);
$row = $stmt->fetch();

dolphin_send_json([
    'connected'  => !empty($row['drive_refresh_token']),
    'has_folder' => !empty($row['drive_root_folder_id']),
    'folder_id'  => $row['drive_root_folder_id'] ?? null,
]);
