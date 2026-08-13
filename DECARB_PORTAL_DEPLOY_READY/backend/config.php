<?php
// Real config — already filled in with your Hostinger DB and Drive OAuth details.
// This file is blocked from direct web access by backend/.htaccess.

return [
    'db' => [
        'host' => 'localhost',
        'name' => 'u833634340_decarb_portal',
        'user' => 'u833634340_decarb_portal',
        'pass' => 'Decarb_portal@2026',
    ],
    'drive' => [
        // OAuth as the real Drive-owning account (dolphindiecast.web@gmail.com) —
        // NOT a service account. Service accounts have no storage quota on
        // personal "My Drive" folders. See oauth-start.php / oauth-callback.php
        // for the one-time authorization that creates token_path's contents.
        'oauth_client_id' => '144411382160-jopdmust38jchf1q6qp4uumvnmflqrs3.apps.googleusercontent.com',
        'oauth_client_secret' => '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',
        'oauth_redirect_uri' => 'https://decarb.deepwoodsgreen.com/backend/oauth-callback.php',
        'token_path' => __DIR__ . '/drive-token.json',
        'root_folder_id' => '1SRz-lmrdK4a4zjGt36xQe5UVi16uUTes',
    ],
    'smtp' => [
        'host' => 'smtp.gmail.com',
        'port' => 587,
        'username' => 'green.featherlite@deepwoodsgreen.com',
        'app_password' => 'hamvuclulwztaafc', // Gmail App Password — never commit; spaces stripped
        'from_email' => 'green.featherlite@deepwoodsgreen.com',
        'from_name' => 'Deepwoods GHG Portal',
    ],
    // All Request Access notifications go to this address
    'admin_email' => 'green@deepwoodsgreen.com',
    // Used to build links inside emails (password reset, etc).
    'app_base_url' => 'https://decarb.deepwoodsgreen.com',
    'api_key' => 'c02fc20af1546bf6ba8c3cd09067c00af26742d68ae76aa2',

    // Notification system
    // cron_secret: passed as ?cron_secret= in the scheduled task URL call
    'cron_secret' => 'fl-ghg-cron-2026',
    // Always CC this address on every notification send (test / oversight inbox)
    'notification_test_email' => 'likhit22ab@gmail.com',

    // GHG Apps Script web app URL (set after deploying Code.gs as a web app).
    // Leave empty to disable live GHG automation (portal still works in demo mode).
    'ghg_webapp_url' => '',

    // Platform branding used in system emails (password reset, etc.)
    'platform_name' => 'Decarb Portal',

    // Base URL used as a fallback in notification emails when per-client portal_url
    // is not set in client_config.
    'platform_base_url' => 'https://decarb.deepwoodsgreen.com',
];
