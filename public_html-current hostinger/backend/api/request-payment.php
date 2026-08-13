<?php
// request-payment.php — POST /backend/api/request-payment.php
// Called by a client user when they've completed setup and are ready for payment.
// Stores a payment_requested flag in client_config and emails the Deepwoods admin.

declare(strict_types=1);
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/Smtp.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Allow-Methods: POST, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$authUser = dolphin_require_auth();
$role     = $authUser['role'] ?? '';
$clientId = (int)($authUser['client_id'] ?? 0);

$clientRoles = ['sustainability_team', 'client_uploader', 'client_leadership'];
if (!in_array($role, $clientRoles, true)) {
    dolphin_send_json(['error' => 'Client role required'], 403);
}
if (!$clientId) {
    dolphin_send_json(['error' => 'No client associated with this account'], 400);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    dolphin_send_json(['error' => 'POST only'], 405);
}

$pdo = dolphin_db();

// Get client details
$clientStmt = $pdo->prepare('SELECT id, name FROM clients WHERE id = ? AND is_active = 1');
$clientStmt->execute([$clientId]);
$client = $clientStmt->fetch();
if (!$client) {
    dolphin_send_json(['error' => 'Client not found or inactive'], 404);
}

// Store the flag (idempotent — safe to call multiple times)
$pdo->prepare(
    'INSERT INTO client_config (client_id, config_key, config_value)
     VALUES (?, \'payment_requested\', \'true\')
     ON DUPLICATE KEY UPDATE config_value = \'true\''
)->execute([$clientId]);

// Send notification email to the Deepwoods admin
$config    = dolphin_config();
$adminEmail = $config['admin_email'] ?? '';
$baseUrl   = rtrim($config['app_base_url'] ?? $config['platform_base_url'] ?? 'https://decarb.sustainablyyours.me', '/');
$smtpCfg   = $config['smtp'] ?? [];
$emailSent = false;

if (
    !empty($adminEmail) &&
    !empty($smtpCfg['host']) &&
    !empty($smtpCfg['username']) &&
    !empty($smtpCfg['app_password'])
) {
    try {
        $smtp = new Smtp(
            $smtpCfg['host'],
            (int)($smtpCfg['port'] ?? 587),
            $smtpCfg['username'],
            $smtpCfg['app_password'],
            $smtpCfg['from_email'] ?? $smtpCfg['username'],
            $smtpCfg['from_name']  ?? 'Deepwoods GHG Portal',
        );

        $clientNameHtml = htmlspecialchars($client['name']);
        $adminUrl       = $baseUrl . '/admin';

        $htmlBody = <<<HTML
<html><body style="font-family:Arial,sans-serif;color:#1a1a1a;max-width:560px;margin:0 auto;padding:24px">
<h2 style="color:#1E6F5C;margin-top:0">&#128276; Payment request — {$clientNameHtml}</h2>
<p>Hello,</p>
<p><strong>{$clientNameHtml}</strong> has completed their organisational boundary setup on the GHG Portal and is ready to proceed with payment.</p>
<p>Please:</p>
<ol style="padding-left:20px;font-size:14px;line-height:1.8">
  <li>Send the invoice to the client manually</li>
  <li>Once payment is received, mark it as paid in the Admin Panel</li>
</ol>
<p style="margin-top:24px">
  <a href="{$adminUrl}" style="display:inline-block;background:#1E6F5C;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px">Open Admin Panel</a>
</p>
<p style="font-size:12px;color:#9CA3AF;margin-top:32px;border-top:1px solid #F3F4F6;padding-top:16px">— Deepwoods GHG Portal · Automated notification</p>
</body></html>
HTML;
        $smtp->send($adminEmail, "Payment request: {$client['name']} is ready", $htmlBody);
        $emailSent = true;
    } catch (Throwable $e) {
        error_log('request-payment: SMTP failed: ' . $e->getMessage());
    }
}

dolphin_send_json(['ok' => true, 'email_sent' => $emailSent]);
