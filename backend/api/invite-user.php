<?php
// invite-user.php — POST /backend/api/invite-user.php
// Deepwoods admin/coordinator creates the first (or any) user for a client.
// Returns the generated temp password so the admin can share it with the client.

declare(strict_types=1);
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/Smtp.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Allow-Methods: POST, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$authUser = dolphin_require_auth();

// Only Deepwoods roles may invite users on behalf of any client.
// Client users must NEVER be able to call this endpoint for other clients.
$deepwoodsRoles = ['deepwoods_admin', 'deepwoods_coordinator'];
if (!in_array($authUser['role'], $deepwoodsRoles, true)) {
    dolphin_send_json(['error' => 'Not authorised — deepwoods_admin or deepwoods_coordinator role required'], 403);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    dolphin_send_json(['error' => 'Method not allowed'], 405);
}

$body     = dolphin_json_body();
$clientId = isset($body['client_id']) ? (int)$body['client_id'] : 0;
$email    = trim(strtolower($body['email'] ?? ''));
$role     = $body['role'] ?? '';

$allowedRoles = ['sustainability_team', 'client_uploader', 'client_leadership'];

// ── Validate inputs ────────────────────────────────────────────────────────────

if (!$clientId) {
    dolphin_send_json(['error' => 'client_id is required'], 400);
}
if ($email === '') {
    dolphin_send_json(['error' => 'Email is required'], 400);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    dolphin_send_json(['error' => 'Invalid email address'], 400);
}
if (!in_array($role, $allowedRoles, true)) {
    dolphin_send_json(['error' => 'Invalid role. Allowed: ' . implode(', ', $allowedRoles)], 400);
}

$pdo = dolphin_db();

// ── Verify client exists ───────────────────────────────────────────────────────

$clientStmt = $pdo->prepare('SELECT id, name FROM clients WHERE id = ?');
$clientStmt->execute([$clientId]);
$client = $clientStmt->fetch();
if (!$client) {
    dolphin_send_json(['error' => 'Client not found'], 404);
}

// ── Generate temp password and insert user ─────────────────────────────────────

$tempPassword = bin2hex(random_bytes(8)); // 16-char hex string

try {
    $pdo->prepare(
        'INSERT INTO users (email, password_hash, role, client_id, must_change_password)
         VALUES (?, ?, ?, ?, 1)'
    )->execute([
        $email,
        password_hash($tempPassword, PASSWORD_BCRYPT),
        $role,
        $clientId,
    ]);
} catch (PDOException $e) {
    if ($e->getCode() === '23000') {
        dolphin_send_json(['error' => 'An account with that email already exists'], 409);
    }
    throw $e;
}

// ── Attempt to send welcome email (non-fatal) ──────────────────────────────────

$config    = dolphin_config();
$emailSent = false;
$smtpCfg   = $config['smtp'] ?? [];
$baseUrl   = rtrim($config['app_base_url'] ?? $config['platform_base_url'] ?? 'https://decarb.sustainablyyours.me', '/');

if (
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
            $smtpCfg['from_name'] ?? 'Deepwoods Decarbonisation Portal',
        );

        $htmlBody = <<<HTML
<html><body style="font-family:Arial,sans-serif;color:#1a1a1a;max-width:560px;margin:0 auto;padding:24px">
<h2 style="color:#1E6F5C;margin-top:0">your Decarbonisation Portal access is ready</h2>
<p>Hello,</p>
<p>A Deepwoods consultant has created your account on the <strong>Decarbonisation Portal</strong>. You can log in using the credentials below.</p>
<table style="border-collapse:collapse;margin:20px 0;width:100%">
  <tr style="border-bottom:1px solid #E5E7EB">
    <td style="padding:10px 16px 10px 0;color:#6B7280;font-size:14px;white-space:nowrap">Login URL</td>
    <td style="padding:10px 0;font-size:14px"><a href="{$baseUrl}" style="color:#1E6F5C">{$baseUrl}</a></td>
  </tr>
  <tr style="border-bottom:1px solid #E5E7EB">
    <td style="padding:10px 16px 10px 0;color:#6B7280;font-size:14px;white-space:nowrap">Email</td>
    <td style="padding:10px 0;font-size:14px">{$email}</td>
  </tr>
  <tr>
    <td style="padding:10px 16px 10px 0;color:#6B7280;font-size:14px;white-space:nowrap">Temporary password</td>
    <td style="padding:10px 0;font-size:14px;font-weight:bold;font-family:monospace;letter-spacing:1px">{$tempPassword}</td>
  </tr>
</table>
<div style="background:#FEF3C7;border:1px solid #FDE68A;border-radius:8px;padding:12px 16px;font-size:13px;color:#92400E;margin:20px 0">
  <strong>Important:</strong> You will be prompted to set a new password on your first login. Please do this immediately after signing in.
</div>
<p style="font-size:13px;color:#6B7280">If you were not expecting this invitation, please ignore this email or contact your Deepwoods consultant.</p>
<p style="font-size:12px;color:#9CA3AF;margin-top:32px;border-top:1px solid #F3F4F6;padding-top:16px">— Deepwoods Decarbonisation Portal · This is an automated message, please do not reply.</p>
</body></html>
HTML;

        $smtp->send($email, 'your Decarbonisation Portal access is ready', $htmlBody);
        $emailSent = true;
    } catch (Throwable $e) {
        // SMTP failure is non-fatal — user was already created, admin has the temp password
        error_log('invite-user: SMTP failed for ' . $email . ': ' . $e->getMessage());
    }
}

dolphin_send_json([
    'ok'            => true,
    'email'         => $email,
    'temp_password' => $tempPassword,
    'email_sent'    => $emailSent,
]);
