<?php
declare(strict_types=1);
// Returns the Google OAuth URL the frontend should open in a popup.
// Deepwoods admins pass ?client_id=X to connect Drive for a specific client.
// The signed state embeds the target client_id so oauth-drive-callback.php
// knows which client row to update.
require __DIR__ . '/../db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    dolphin_send_json(['error' => 'GET only'], 405);
}

$authUser = dolphin_require_auth();
$config   = dolphin_config();

$isAdmin = in_array($authUser['role'], ['deepwoods_admin', 'deepwoods_coordinator'], true);

if ($isAdmin) {
    $targetClientId = (int)($_GET['client_id'] ?? 0);
    if ($targetClientId <= 0) {
        dolphin_send_json(['error' => 'client_id is required for admin Drive connect'], 400);
    }
    // Verify the client exists
    $pdo  = dolphin_db();
    $stmt = $pdo->prepare('SELECT id FROM clients WHERE id = ?');
    $stmt->execute([$targetClientId]);
    if (!$stmt->fetch()) {
        dolphin_send_json(['error' => 'Client not found'], 404);
    }
    $clientId = $targetClientId;
} else {
    // Non-admin users connect their own client's Drive (future use).
    dolphin_require_active_client($authUser);
    $clientId = (int)$authUser['client_id'];
}

// HMAC-signed state: "clientId:mac" — prevents CSRF without a session table.
$secret = $config['app_secret'] ?? 'dolphin-drive-secret';
$mac    = hash_hmac('sha256', (string)$clientId, $secret);
$state  = base64_encode($clientId . ':' . $mac);

$url = 'https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query([
    'client_id'     => $config['drive']['oauth_client_id'],
    'redirect_uri'  => $config['drive']['oauth_drive_redirect_uri'],
    'response_type' => 'code',
    'scope'         => 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/spreadsheets',
    'access_type'   => 'offline',
    'prompt'        => 'consent',
    'state'         => $state,
]);

dolphin_send_json(['auth_url' => $url]);
