<?php
declare(strict_types=1);
// Google redirects here after you click "Allow" on the consent screen.
// Exchanges the one-time authorization code for a refresh token and saves
// it to drive-token.json. After this runs successfully once, it's done —
// GoogleDrive.php uses that saved token for every future upload.

$config = require __DIR__ . '/config.php';
header('Content-Type: text/plain');

$code = $_GET['code'] ?? null;
$error = $_GET['error'] ?? null;

if ($error) {
    die("Google returned an error: $error\n\nThis usually means the account you're logged in as wasn't added as a test user, or you clicked Deny.");
}
if (!$code) {
    die("Missing authorization code. Visit the authorization link (see below) instead of this URL directly.\n\n" . authUrl($config));
}

$ch = curl_init('https://oauth2.googleapis.com/token');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POSTFIELDS => http_build_query([
        'code' => $code,
        'client_id' => $config['drive']['oauth_client_id'],
        'client_secret' => $config['drive']['oauth_client_secret'],
        'redirect_uri' => $config['drive']['oauth_redirect_uri'],
        'grant_type' => 'authorization_code',
    ]),
]);
$response = curl_exec($ch);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$data = json_decode($response, true) ?? [];

if ($status !== 200 || empty($data['refresh_token'])) {
    echo "FAILED to get a refresh token.\n\n";
    echo "Raw response: $response\n\n";
    if ($status === 200 && empty($data['refresh_token'])) {
        echo "Google returned an access token but no refresh token — this happens when the app was\n";
        echo "already authorized before. Go to https://myaccount.google.com/permissions , remove access\n";
        echo "for 'Deepwoods GHG Portal', then visit the authorization link again:\n\n" . authUrl($config);
    }
    exit;
}

file_put_contents($config['drive']['token_path'], json_encode(['refresh_token' => $data['refresh_token']], JSON_PRETTY_PRINT));

echo "SUCCESS\n\n";
echo "Drive authorization complete — refresh token saved.\n";
echo "Next: visit backend/test-drive-upload.php to confirm uploads now work.\n";
echo "Once confirmed, this file (oauth-callback.php) can stay — you won't need it again unless\n";
echo "the token is ever revoked — but you can delete client_secret download files from your computer.\n";

function authUrl(array $config): string {
    return 'https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query([
        'client_id' => $config['drive']['oauth_client_id'],
        'redirect_uri' => $config['drive']['oauth_redirect_uri'],
        'response_type' => 'code',
        'scope' => 'https://www.googleapis.com/auth/drive',
        'access_type' => 'offline',
        'prompt' => 'consent',
    ]);
}
