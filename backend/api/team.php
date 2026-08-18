<?php
// team.php — GET / POST / DELETE /backend/api/team.php
// Client team management. Allowed role: sustainability_team (Owner/ESG Manager).
// Strictly scoped to the caller's own client_id — caller never supplies it.

declare(strict_types=1);
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/Smtp.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$authUser = dolphin_require_auth();
$clientId = (int)$authUser['client_id'];

// Only sustainability_team (Owner / ESG Manager) may manage the team
if ($authUser['role'] !== 'sustainability_team') {
    dolphin_send_json(['error' => 'Not authorised — sustainability_team role required'], 403);
}
if (!$clientId) {
    dolphin_send_json(['error' => 'No client associated with this account'], 403);
}

// Server-side activation gate: team management requires an active client
dolphin_require_active_client($authUser);

$pdo    = dolphin_db();
$method = $_SERVER['REQUEST_METHOD'];

// ── GET — list team members for this client ────────────────────────────────────

if ($method === 'GET') {
    $stmt = $pdo->prepare(
        'SELECT id, email, role, entity_scope, must_change_password, created_at
         FROM users WHERE client_id = ? ORDER BY created_at ASC'
    );
    $stmt->execute([$clientId]);
    $rows = $stmt->fetchAll();
    // Normalise types
    foreach ($rows as &$r) {
        $r['id']                   = (int)$r['id'];
        $r['must_change_password'] = (bool)$r['must_change_password'];
    }
    unset($r);
    dolphin_send_json($rows);
}

// ── POST — invite a new team member ───────────────────────────────────────────

if ($method === 'POST') {
    $body  = dolphin_json_body();
    $email = trim(strtolower($body['email'] ?? ''));
    $role  = $body['role'] ?? '';
    $entityScope = isset($body['entity_scope']) && $body['entity_scope'] !== ''
                   ? trim($body['entity_scope']) : null;

    // Only client roles are permitted — never Deepwoods roles
    $allowed = ['sustainability_team', 'client_uploader', 'client_leadership'];
    if ($email === '') {
        dolphin_send_json(['error' => 'Email is required'], 400);
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        dolphin_send_json(['error' => 'Invalid email address'], 400);
    }
    if (!in_array($role, $allowed, true)) {
        dolphin_send_json(['error' => 'Invalid role. Allowed: ' . implode(', ', $allowed)], 400);
    }
    // If entity_scope is supplied, verify it belongs to this client
    if ($entityScope !== null) {
        $chk = $pdo->prepare('SELECT code FROM client_entities WHERE client_id = ? AND code = ?');
        $chk->execute([$clientId, $entityScope]);
        if (!$chk->fetch()) {
            dolphin_send_json(['error' => 'entity_scope does not match a known entity for this client'], 400);
        }
    }

    $tempPassword = bin2hex(random_bytes(8)); // 16-char hex string

    try {
        $pdo->prepare(
            'INSERT INTO users (email, password_hash, role, client_id, entity_scope, must_change_password)
             VALUES (?, ?, ?, ?, ?, 1)'
        )->execute([
            $email,
            password_hash($tempPassword, PASSWORD_BCRYPT),
            $role,
            $clientId,   // always from auth, never from request body
            $entityScope,
        ]);
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') {
            dolphin_send_json(['error' => 'An account with that email already exists'], 409);
        }
        throw $e;
    }

    // Lookup client name for email
    $clientRow = $pdo->prepare('SELECT name FROM clients WHERE id = ?');
    $clientRow->execute([$clientId]);
    $client = $clientRow->fetch();
    $clientName = $client['name'] ?? 'your organisation';

    // Send invite email (non-fatal)
    $config    = dolphin_config();
    $emailSent = false;
    $smtpCfg   = $config['smtp'] ?? [];
    $baseUrl   = rtrim($config['platform_base_url'] ?? 'https://decarb.sustainablyyours.me', '/');

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

            $roleLabel = [
                'sustainability_team' => 'ESG Manager',
                'client_uploader'     => 'Data Submitter',
                'client_leadership'   => 'Viewer',
            ][$role] ?? $role;

            $htmlBody = <<<HTML
<html><body style="font-family:Arial,sans-serif;color:#1a1a1a;max-width:560px;margin:0 auto;padding:24px">
<h2 style="color:#1E6F5C;margin-top:0">You've been invited to the Decarbonisation Portal</h2>
<p>Hello,</p>
<p>You have been added to the <strong>{$clientName}</strong> workspace on the Decarbonisation Portal as <strong>{$roleLabel}</strong>. Use the credentials below to log in for the first time.</p>
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
  <strong>Important:</strong> You will be asked to set a new password on your first login. Please do this immediately.
</div>
<p style="font-size:13px;color:#6B7280">If you were not expecting this invitation, please contact your team administrator.</p>
<p style="font-size:12px;color:#9CA3AF;margin-top:32px;border-top:1px solid #F3F4F6;padding-top:16px">— Deepwoods Decarbonisation Portal · This is an automated message, please do not reply.</p>
</body></html>
HTML;

            $smtp->send($email, "You've been invited to the Decarbonisation Portal", $htmlBody);
            $emailSent = true;
        } catch (Throwable $e) {
            error_log('team.php invite email failed for ' . $email . ': ' . $e->getMessage());
        }
    }

    dolphin_send_json([
        'ok'           => true,
        'email'        => $email,
        'role'         => $role,
        'temp_password' => $tempPassword,
        'email_sent'   => $emailSent,
    ]);
}

// ── DELETE — remove a team member ?id=X ───────────────────────────────────────

if ($method === 'DELETE') {
    $userId = isset($_GET['id']) ? (int)$_GET['id'] : 0;
    if (!$userId) {
        dolphin_send_json(['error' => 'id query parameter is required'], 400);
    }
    // Must belong to this client
    $stmt = $pdo->prepare('SELECT id, email FROM users WHERE id = ? AND client_id = ?');
    $stmt->execute([$userId, $clientId]);
    $target = $stmt->fetch();
    if (!$target) {
        dolphin_send_json(['error' => 'User not found in your team'], 404);
    }
    // Prevent self-deletion
    if ((int)$authUser['id'] === $userId) {
        dolphin_send_json(['error' => 'You cannot remove yourself from the team'], 400);
    }
    $pdo->prepare('DELETE FROM users WHERE id = ? AND client_id = ?')->execute([$userId, $clientId]);
    dolphin_send_json(['ok' => true]);
}

dolphin_send_json(['error' => 'Method not allowed'], 405);
