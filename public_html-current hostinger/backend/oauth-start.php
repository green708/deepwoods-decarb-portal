<?php
declare(strict_types=1);
// Visit this URL (while logged into the Google account that owns the Drive
// folder) to kick off the one-time authorization. It redirects to Google's
// consent screen; after you click Allow, Google sends you to
// oauth-callback.php, which saves the refresh token.

$config = require __DIR__ . '/config.php';

$url = 'https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query([
    'client_id' => $config['drive']['oauth_client_id'],
    'redirect_uri' => $config['drive']['oauth_redirect_uri'],
    'response_type' => 'code',
    'scope' => 'https://www.googleapis.com/auth/drive',
    'access_type' => 'offline',
    'prompt' => 'consent',
]);

header('Location: ' . $url);
exit;
