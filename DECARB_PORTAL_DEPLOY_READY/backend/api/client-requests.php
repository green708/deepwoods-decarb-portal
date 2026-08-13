<?php
// client-requests.php — GET / PATCH / POST /backend/api/client-requests.php
// Deepwoods staff: list and manage prospect access requests.
//
// GET                                → list all client_requests rows (admin + coordinator)
// PATCH { id, status }               → update status: new|contacted|rejected (admin + coordinator)
// POST  { action:"convert", id, name, slug, currency?, reporting_period? }
//                                    → create client + mark request as converted (admin only)

declare(strict_types=1);
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/Smtp.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Allow-Methods: GET, POST, PATCH, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$authUser = dolphin_require_auth();

$role    = $authUser['role'] ?? '';
$isAdmin = $role === 'deepwoods_admin';
$isStaff = in_array($role, ['deepwoods_admin', 'deepwoods_coordinator'], true);

if (!$isStaff) {
    dolphin_send_json(['error' => 'Deepwoods staff role required'], 403);
}

$pdo    = dolphin_db();
$method = $_SERVER['REQUEST_METHOD'];

// ── GET — list all requests ───────────────────────────────────────────────────

if ($method === 'GET') {
    $stmt = $pdo->query(
        "SELECT id, name, company, email, phone, employees, message, status, created_at, updated_at
         FROM client_requests
         ORDER BY
           FIELD(status,'new','contacted','rejected','converted'),
           created_at DESC"
    );
    dolphin_send_json($stmt->fetchAll(PDO::FETCH_ASSOC));
}

// ── PATCH — update request status ────────────────────────────────────────────

if ($method === 'PATCH') {
    $body   = dolphin_json_body();
    $id     = (int)($body['id']     ?? 0);
    $status = $body['status'] ?? '';

    if ($id <= 0) {
        dolphin_send_json(['error' => 'id is required'], 422);
    }
    if (!in_array($status, ['new', 'contacted', 'rejected'], true)) {
        dolphin_send_json(['error' => 'status must be new, contacted, or rejected'], 422);
    }

    $check = $pdo->prepare("SELECT status FROM client_requests WHERE id = ?");
    $check->execute([$id]);
    $current = $check->fetchColumn();

    if ($current === false) {
        dolphin_send_json(['error' => 'Request not found'], 404);
    }
    if ($current === 'converted') {
        dolphin_send_json(['error' => 'Cannot change status of a converted request'], 409);
    }

    $pdo->prepare("UPDATE client_requests SET status = ? WHERE id = ?")
        ->execute([$status, $id]);

    dolphin_send_json(['ok' => true]);
}

// ── POST — convert request to client ─────────────────────────────────────────

if ($method === 'POST') {
    if (!$isAdmin) {
        dolphin_send_json(['error' => 'deepwoods_admin role required to convert requests'], 403);
    }

    $body   = dolphin_json_body();
    $action = $body['action'] ?? '';

    if ($action !== 'convert') {
        dolphin_send_json(['error' => 'Unknown action — expected "convert"'], 422);
    }

    $id              = (int)($body['id']               ?? 0);
    $name            = trim($body['name']              ?? '');
    $slug            = trim(strtolower($body['slug']   ?? ''));
    $currency        = in_array($body['currency'] ?? '', ['INR', 'USD', 'EUR', 'GBP'], true)
                       ? $body['currency'] : 'INR';
    $reportingPeriod = in_array($body['reporting_period'] ?? '', ['FY', 'CY'], true)
                       ? $body['reporting_period'] : 'FY';
    $inviteEmail     = trim(strtolower($body['invite_email'] ?? ''));
    $inviteRole      = in_array($body['invite_role'] ?? '', ['sustainability_team', 'client_uploader', 'client_leadership'], true)
                       ? $body['invite_role'] : 'sustainability_team';

    if ($id <= 0)     dolphin_send_json(['error' => 'id is required'], 422);
    if ($name === '') dolphin_send_json(['error' => 'name is required'], 422);

    // Sanitise slug
    $slug = preg_replace('/[^a-z0-9-]/', '', $slug);
    $slug = preg_replace('/-+/', '-', trim($slug, '-'));
    if ($slug === '') dolphin_send_json(['error' => 'slug is required and must be lowercase alphanumeric'], 422);

    // Load the request
    $reqStmt = $pdo->prepare("SELECT id, company, email, status FROM client_requests WHERE id = ?");
    $reqStmt->execute([$id]);
    $request = $reqStmt->fetch(PDO::FETCH_ASSOC);

    if (!$request) {
        dolphin_send_json(['error' => 'Request not found'], 404);
    }
    if ($request['status'] === 'converted') {
        dolphin_send_json(['error' => 'This request has already been converted to a client'], 409);
    }

    // Fall back to the contact email from the access request if not overridden
    if ($inviteEmail === '') {
        $inviteEmail = strtolower(trim($request['email'] ?? ''));
    }

    try {
        $pdo->beginTransaction();

        // 1. Create the client — immediately active so credentials can be sent right away
        $clientStmt = $pdo->prepare(
            'INSERT INTO clients (name, slug, logo_url, primary_color, currency, reporting_period, is_active, activated_at)
             VALUES (?, ?, ?, ?, ?, ?, 1, NOW())'
        );
        $clientStmt->execute([$name, $slug, '/deepwoods-logo.png', '#1E6F5C', $currency, $reportingPeriod]);
        $clientId = (int)$pdo->lastInsertId();

        // 2. Create the default consolidated entity
        $entityCode = strtoupper(preg_replace('/[^a-zA-Z0-9]/', '', $slug));
        $entityCode = substr($entityCode, 0, 6) ?: 'ENTITY';
        $entityStmt = $pdo->prepare(
            'INSERT IGNORE INTO client_entities (client_id, code, name, short_name, is_consolidated, sort_order)
             VALUES (?, ?, ?, ?, 1, 1)'
        );
        $entityStmt->execute([$clientId, $entityCode, $name, $entityCode]);

        // 3. Default client config (setup_complete = false)
        $pdo->prepare(
            'INSERT INTO client_config (client_id, config_key, config_value)
             VALUES (?, \'setup_complete\', \'false\')
             ON DUPLICATE KEY UPDATE config_value = \'false\''
        )->execute([$clientId]);

        // 3b. Store the contact email so the Activation tab can pre-fill the invite
        if (!empty($request['email'])) {
            $pdo->prepare(
                'INSERT INTO client_config (client_id, config_key, config_value)
                 VALUES (?, \'contact_email\', ?)
                 ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)'
            )->execute([$clientId, $request['email']]);
        }

        // 4. Mark request as converted
        $pdo->prepare("UPDATE client_requests SET status = 'converted' WHERE id = ?")
            ->execute([$id]);

        $pdo->commit();

    } catch (PDOException $e) {
        $pdo->rollBack();
        if ($e->getCode() === '23000') {
            dolphin_send_json(['error' => 'A client with that slug already exists — choose another slug'], 409);
        }
        error_log('client-requests convert error: ' . $e->getMessage());
        dolphin_send_json(['error' => 'Conversion failed. Please try again.'], 500);
    }

    // ── After commit: create user account and send welcome email ─────────────
    $tempPassword = null;
    $emailSent    = false;

    if (filter_var($inviteEmail, FILTER_VALIDATE_EMAIL)) {
        $tempPassword = bin2hex(random_bytes(8));
        try {
            $pdo->prepare(
                'INSERT INTO users (email, password_hash, role, client_id, must_change_password)
                 VALUES (?, ?, ?, ?, 1)'
            )->execute([
                $inviteEmail,
                password_hash($tempPassword, PASSWORD_BCRYPT),
                $inviteRole,
                $clientId,
            ]);
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') {
                $tempPassword = null; // user already exists — skip invite
            } else {
                error_log('client-requests invite user error: ' . $e->getMessage());
            }
        }

        if ($tempPassword !== null) {
            $cfg     = dolphin_config();
            $baseUrl = rtrim($cfg['app_base_url'] ?? $cfg['platform_base_url'] ?? 'https://decarb.sustainablyyours.me', '/');
            $smtpCfg = $cfg['smtp'] ?? [];
            if (!empty($smtpCfg['host']) && !empty($smtpCfg['username']) && !empty($smtpCfg['app_password'])) {
                try {
                    $smtp = new Smtp(
                        $smtpCfg['host'],
                        (int)($smtpCfg['port'] ?? 587),
                        $smtpCfg['username'],
                        $smtpCfg['app_password'],
                        $smtpCfg['from_email'] ?? $smtpCfg['username'],
                        $smtpCfg['from_name']  ?? 'Deepwoods GHG Portal',
                    );
                    $clientNameHtml = htmlspecialchars($name);
                    $htmlBody = <<<HTML
<html><body style="font-family:Arial,sans-serif;color:#1a1a1a;max-width:560px;margin:0 auto;padding:24px">
<h2 style="color:#1E6F5C;margin-top:0">Welcome to the GHG Portal — {$clientNameHtml}</h2>
<p>Hello,</p>
<p>Your organisation has been accepted onto the <strong>Deepwoods GHG Portal</strong>. Log in using the credentials below to get started with your organisational boundary setup.</p>
<table style="border-collapse:collapse;margin:20px 0;width:100%">
  <tr style="border-bottom:1px solid #E5E7EB">
    <td style="padding:10px 16px 10px 0;color:#6B7280;font-size:14px;white-space:nowrap">Portal URL</td>
    <td style="padding:10px 0;font-size:14px"><a href="{$baseUrl}" style="color:#1E6F5C">{$baseUrl}</a></td>
  </tr>
  <tr style="border-bottom:1px solid #E5E7EB">
    <td style="padding:10px 16px 10px 0;color:#6B7280;font-size:14px;white-space:nowrap">Email</td>
    <td style="padding:10px 0;font-size:14px">{$inviteEmail}</td>
  </tr>
  <tr>
    <td style="padding:10px 16px 10px 0;color:#6B7280;font-size:14px;white-space:nowrap">Temporary password</td>
    <td style="padding:10px 0;font-size:14px;font-weight:bold;font-family:monospace;letter-spacing:1px">{$tempPassword}</td>
  </tr>
</table>
<div style="background:#FEF3C7;border:1px solid #FDE68A;border-radius:8px;padding:12px 16px;font-size:13px;color:#92400E;margin:20px 0">
  <strong>Next step:</strong> Log in and change your password immediately. Then complete your organisational boundary setup — a Deepwoods consultant will guide you through the payment step once that's done.
</div>
<p style="font-size:12px;color:#9CA3AF;margin-top:32px;border-top:1px solid #F3F4F6;padding-top:16px">— Deepwoods GHG Portal · This is an automated message, please do not reply.</p>
</body></html>
HTML;
                    $smtp->send($inviteEmail, "Welcome to the Deepwoods GHG Portal — your login credentials", $htmlBody);
                    $emailSent = true;
                } catch (Throwable $e) {
                    error_log('client-requests welcome email failed for ' . $inviteEmail . ': ' . $e->getMessage());
                }
            }
        }
    }

    dolphin_send_json([
        'ok'           => true,
        'client_id'    => $clientId,
        'slug'         => $slug,
        'invite_email' => $inviteEmail ?: null,
        'temp_password'=> $tempPassword,
        'email_sent'   => $emailSent,
    ], 201);
}

dolphin_send_json(['error' => 'GET, PATCH, or POST only'], 405);
