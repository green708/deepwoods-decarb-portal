<?php
declare(strict_types=1);

// Catch any fatal error and write it to a log file (display_errors may be
// suppressed at the server level on shared hosting).
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

ini_set('display_errors', '1');
error_reporting(E_ALL);

// Send header BEFORE requiring config.php — config.php may have a UTF-8 BOM
// that gets output on require, which would cause "headers already sent" if we
// call header() afterwards.
header('Content-Type: text/plain');

$config = require __DIR__ . '/config.php';

$code  = $_GET['code']  ?? null;
$error = $_GET['error'] ?? null;

if ($error) {
    die("Google returned an error: $error\n\nThis usually means the account you're logged in as wasn't added as a test user, or you clicked Deny.");
}
if (!$code) {
    die("Missing authorization code. Visit the authorization link (see below) instead of this URL directly.\n\n" . authUrl($config));
}

$ch = curl_init('https://oauth2.googleapis.com/token');
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POSTFIELDS     => http_build_query([
        'code'          => $code,
        'client_id'     => $config['drive']['oauth_client_id'],
        'client_secret' => $config['drive']['oauth_client_secret'],
        'redirect_uri'  => $config['drive']['oauth_redirect_uri'],
        'grant_type'    => 'authorization_code',
    ]),
]);
$response = curl_exec($ch);
$status   = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$data = json_decode($response, true) ?? [];

if ($status !== 200 || empty($data['refresh_token'])) {
    echo "FAILED to get a refresh token.\n\n";
    echo "Raw response: $response\n\n";
    if ($status === 200 && empty($data['refresh_token'])) {
        echo "Google returned an access token but no refresh token — this happens when the app was\n";
        echo "already authorized before. Go to https://myaccount.google.com/permissions , remove access\n";
        echo "for 'Deepwoods Decarbonisation Portal', then visit the authorization link again:\n\n" . authUrl($config);
    }
    exit;
}

file_put_contents(
    $config['drive']['token_path'],
    json_encode(['refresh_token' => $data['refresh_token']], JSON_PRETTY_PRINT)
);

echo "SUCCESS\n\n";
echo "Drive authorization complete — refresh token saved.\n";
echo "Next: visit backend/setup-drive.php to pre-create the Decarb Portal folder structure.\n";
echo "Once confirmed, this file (oauth-callback.php) can stay — you won't need it again unless\n";
echo "the token is ever revoked — but you can delete client_secret download files from your computer.\n";

function authUrl(array $config): string {
    return 'https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query([
        'client_id'     => $config['drive']['oauth_client_id'],
        'redirect_uri'  => $config['drive']['oauth_redirect_uri'],
        'response_type' => 'code',
        'scope'         => 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/spreadsheets',
        'access_type'   => 'offline',
        'prompt'        => 'consent',
    ]);
}
