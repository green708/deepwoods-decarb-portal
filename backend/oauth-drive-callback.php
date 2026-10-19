<?php
declare(strict_types=1);
// Per-client Drive OAuth callback.
// Google redirects here after the client authorizes Drive access.
// Stores the refresh token in clients.drive_refresh_token for the specific client.
register_shutdown_function(function () {
    $e = error_get_last();
    if ($e && in_array($e['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR], true)) {
        file_put_contents(
            __DIR__ . '/oauth-error.log',
            date('c') . " FATAL[{$e['type']}]: {$e['message']} in {$e['file']}:{$e['line']}\n",
            FILE_APPEND
        );
    }
});

header('Content-Type: text/html; charset=utf-8');
$config = require __DIR__ . '/config.php';
require __DIR__ . '/api/db.php';

$code  = $_GET['code']  ?? null;
$state = $_GET['state'] ?? null;
$error = $_GET['error'] ?? null;

if ($error) {
    die("<h2>Drive authorization cancelled</h2><p>Google returned: <code>$error</code></p><p>Please close this window and try again from the portal.</p>");
}
if (!$code || !$state) {
    die('<h2>Invalid callback</h2><p>Missing code or state. Please return to the portal and retry.</p>');
}

// Verify HMAC-signed state
$decoded = base64_decode($state, true);
if ($decoded === false || substr_count($decoded, ':') < 1) {
    die('<h2>Invalid state</h2><p>The authorization state is invalid. Please return to the portal and retry.</p>');
}
[$clientIdStr, $mac] = explode(':', $decoded, 2);
$clientId = (int)$clientIdStr;
$secret   = $config['app_secret'] ?? 'dolphin-drive-secret';
$expected = hash_hmac('sha256', (string)$clientId, $secret);
if (!hash_equals($expected, $mac) || $clientId <= 0) {
    die('<h2>State mismatch</h2><p>CSRF check failed. Please return to the portal and retry.</p>');
}

// Exchange code for tokens
$ch = curl_init('https://oauth2.googleapis.com/token');
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POSTFIELDS     => http_build_query([
        'code'          => $code,
        'client_id'     => $config['drive']['oauth_client_id'],
        'client_secret' => $config['drive']['oauth_client_secret'],
        'redirect_uri'  => $config['drive']['oauth_drive_redirect_uri'],
        'grant_type'    => 'authorization_code',
    ]),
]);
$response = curl_exec($ch);
$status   = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$data = json_decode($response, true) ?? [];

if ($status !== 200 || empty($data['refresh_token'])) {
    echo '<h2>Authorization failed</h2>';
    echo '<p>Google did not return a refresh token.</p>';
    if (empty($data['refresh_token']) && !empty($data['access_token'])) {
        echo '<p><strong>The account was already authorized.</strong> Go to <a href="https://myaccount.google.com/permissions" target="_blank">myaccount.google.com/permissions</a>, remove access for "Deepwoods Decarbonisation Portal", then try again from the portal.</p>';
    } else {
        echo '<pre>' . htmlspecialchars($response) . '</pre>';
    }
    exit;
}

// Store refresh token for this client
$pdo = dolphin_db();
$pdo->prepare('UPDATE clients SET drive_refresh_token = ? WHERE id = ?')
    ->execute([$data['refresh_token'], $clientId]);

// Get the portal URL from config for the redirect
$portalUrl = $config['portal_url'] ?? '/';
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Google Drive connected</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 500px; margin: 60px auto; text-align: center; color: #1a1a1a; }
    .icon { font-size: 64px; margin-bottom: 16px; }
    h2 { color: #1E6F5C; margin-bottom: 8px; }
    p { color: #555; }
    a { display: inline-block; margin-top: 24px; padding: 12px 28px; background: #1E6F5C; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; }
  </style>
  <script>
    // Auto-close after 3 s if opened in a popup, otherwise redirect.
    setTimeout(function() {
      if (window.opener) { window.close(); }
      else { window.location.href = <?= json_encode($portalUrl) ?>; }
    }, 3000);
  </script>
</head>
<body>
  <div class="icon">✅</div>
  <h2>Google Drive connected!</h2>
  <p>Your Drive account has been authorized. Future file uploads will go directly to your Drive.</p>
  <p>This window will close automatically…</p>
  <a href="<?= htmlspecialchars($portalUrl) ?>">Return to portal</a>
</body>
</html>
