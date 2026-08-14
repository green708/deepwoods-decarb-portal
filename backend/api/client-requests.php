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
        "SELECT id, name, company, email, phone, employees, message,
                COALESCE(industry,        '') AS industry,
                COALESCE(is_india,        1)  AS is_india,
                COALESCE(gstin,           '') AS gstin,
                COALESCE(legal_name,      '') AS legal_name,
                COALESCE(operating_name,  '') AS operating_name,
                COALESCE(org_type,        '') AS org_type,
                is_msme,
                COALESCE(legal_address,   '') AS legal_address,
                COALESCE(website,         '') AS website,
                status, created_at, updated_at
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

    // Fetch request details before updating (needed for rejection email)
    $fetchReq = $pdo->prepare("SELECT name, company, email FROM client_requests WHERE id = ?");
    $fetchReq->execute([$id]);
    $reqRow = $fetchReq->fetch(PDO::FETCH_ASSOC);

    $pdo->prepare("UPDATE client_requests SET status = ? WHERE id = ?")
        ->execute([$status, $id]);

    // Send rejection email if applicable
    $emailSent = false;
    if ($status === 'rejected' && $reqRow && filter_var($reqRow['email'] ?? '', FILTER_VALIDATE_EMAIL)) {
        $cfg     = dolphin_config();
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
                $contactName = htmlspecialchars($reqRow['name'] ?? 'there');
                $companyName = htmlspecialchars($reqRow['company'] ?? '');
                $htmlBody = <<<HTML
<html><body style="font-family:Arial,sans-serif;color:#1a1a1a;max-width:560px;margin:0 auto;padding:24px">
<h2 style="color:#1E6F5C;margin-top:0">Your registration request — Deepwoods GHG Portal</h2>
<p>Hello {$contactName},</p>
<p>Thank you for your interest in the <strong>Deepwoods GHG Portal</strong> for <strong>{$companyName}</strong>.</p>
<p>After reviewing your registration request, we are unable to proceed at this time. This may be because the portal isn't the right fit for your current stage, or we may already be in conversations with another contact at your organisation.</p>
<p>If you believe this is an error or would like to discuss further, please reach out to your Deepwoods account manager directly.</p>
<p style="font-size:12px;color:#9CA3AF;margin-top:32px;border-top:1px solid #F3F4F6;padding-top:16px">— Deepwoods GHG Portal · This is an automated message, please do not reply.</p>
</body></html>
HTML;
                $smtp->send($reqRow['email'], "Your Deepwoods GHG Portal registration request", $htmlBody);
                $emailSent = true;
            } catch (Throwable $e) {
                error_log('client-requests rejection email failed for ' . $reqRow['email'] . ': ' . $e->getMessage());
            }
        }
    }

    dolphin_send_json(['ok' => true, 'email_sent' => $emailSent]);
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
    $smtpDiag     = null; // safe diagnostic code returned to admin UI

    if (filter_var($inviteEmail, FILTER_VALIDATE_EMAIL)) {
        $tempPassword = bin2hex(random_bytes(8));

        // [diag:A] User creation
        error_log('[invite:A] user-create start slug=' . $slug);
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
            error_log('[invite:A:ok] user row inserted client_id=' . $clientId);
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') {
                $tempPassword = null;
                $smtpDiag     = 'email_skipped_user_exists';
                error_log('[invite:A:dup] user already exists — email skipped');
            } else {
                error_log('[invite:A:err] user insert failed: ' . $e->getMessage());
            }
        }

        if ($tempPassword !== null) {
            $cfg     = dolphin_config();
            $baseUrl = rtrim($cfg['app_base_url'] ?? $cfg['platform_base_url'] ?? 'https://decarb.sustainablyyours.me', '/');
            $smtpCfg = $cfg['smtp'] ?? [];

            // [diag:B] SMTP config presence
            $smtpHost = $smtpCfg['host']         ?? '';
            $smtpUser = $smtpCfg['username']      ?? '';
            $smtpPass = $smtpCfg['app_password']  ?? '';
            error_log('[invite:B] smtp-config host=' . ($smtpHost ? 'set' : 'MISSING')
                . ' user=' . ($smtpUser ? 'set' : 'MISSING')
                . ' pass=' . ($smtpPass ? 'set' : 'MISSING'));

            if ($smtpHost && $smtpUser && $smtpPass) {
                try {
                    $smtp = new Smtp(
                        $smtpHost,
                        (int)($smtpCfg['port'] ?? 587),
                        $smtpUser,
                        $smtpPass,
                        $smtpCfg['from_email'] ?? $smtpUser,
                        $smtpCfg['from_name']  ?? 'Deepwoods GHG Portal',
                    );
                    $clientNameHtml = htmlspecialchars($name);
                    $htmlBody = <<<HTML
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:32px 16px">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)">
      <tr>
        <td style="background:#1E6F5C;padding:28px 36px">
          <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff">Deepwoods Decarb Portal</p>
          <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.80)">Your workspace is ready</p>
        </td>
      </tr>
      <tr>
        <td style="padding:32px 36px">
          <p style="margin:0 0 16px;font-size:15px;color:#111827;line-height:1.6">Hello,</p>
          <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6">
            <strong style="color:#111827">{$clientNameHtml}</strong> has been set up on the Deepwoods Decarb Portal.
            Use the details below to sign in and begin your onboarding.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:8px;margin-bottom:24px">
            <tr style="border-bottom:1px solid #E5E7EB">
              <td style="padding:12px 16px;font-size:13px;color:#6B7280;white-space:nowrap;width:150px">Portal</td>
              <td style="padding:12px 16px;font-size:13px"><a href="{$baseUrl}" style="color:#1E6F5C;font-weight:600;text-decoration:none">{$baseUrl}</a></td>
            </tr>
            <tr style="border-bottom:1px solid #E5E7EB">
              <td style="padding:12px 16px;font-size:13px;color:#6B7280;white-space:nowrap">Email</td>
              <td style="padding:12px 16px;font-size:13px;color:#111827">{$inviteEmail}</td>
            </tr>
            <tr>
              <td style="padding:12px 16px;font-size:13px;color:#6B7280;white-space:nowrap">One-time access code</td>
              <td style="padding:12px 16px;font-size:14px;font-family:monospace;font-weight:700;color:#1E6F5C;letter-spacing:2px">{$tempPassword}</td>
            </tr>
          </table>
          <table cellpadding="0" cellspacing="0" style="margin-bottom:24px">
            <tr>
              <td style="background:#1E6F5C;border-radius:8px">
                <a href="{$baseUrl}" style="display:block;padding:12px 28px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none">Sign in to your workspace</a>
              </td>
            </tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#FEF9C3;border:1px solid #FDE68A;border-radius:8px;margin-bottom:24px">
            <tr>
              <td style="padding:12px 16px;font-size:13px;color:#92400E;line-height:1.5">
                You will be prompted to set a new password on first sign-in.
              </td>
            </tr>
          </table>
          <p style="margin:0;font-size:12px;color:#9CA3AF;line-height:1.5">If you did not request access to the Deepwoods Decarb Portal, please disregard this message.</p>
        </td>
      </tr>
      <tr>
        <td style="background:#F9FAFB;border-top:1px solid #E5E7EB;padding:16px 36px">
          <p style="margin:0;font-size:11px;color:#9CA3AF">Deepwoods GreenTech &middot; This is an automated message, please do not reply.</p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>
HTML;
                    // [diag:C] Smtp::send() — password is NOT logged
                    error_log('[invite:C] calling Smtp::send to=' . $inviteEmail . ' port=' . (int)($smtpCfg['port'] ?? 587));
                    $smtp->send($inviteEmail, "You're invited to the Deepwoods Decarb Portal", $htmlBody);
                    $emailSent = true;
                    $smtpDiag  = 'smtp_accepted';
                    error_log('[invite:C:ok] Smtp::send returned 250 — email_sent=true');
                } catch (Throwable $e) {
                    // Classify by SMTP stage. The exception message contains the server
                    // response text (e.g. "535 5.7.8 Username and Password not accepted")
                    // but never the App Password or the temp password.
                    $errMsg = $e->getMessage();
                    error_log('[invite:C:err] Smtp::send threw: ' . $errMsg);
                    preg_match('/expected (\d+)/', $errMsg, $expM);
                    $expCode = (int)($expM[1] ?? 0);
                    if (str_contains($errMsg, 'Could not connect')) {
                        $smtpDiag = 'smtp_connection_failed';
                    } elseif (str_contains($errMsg, 'STARTTLS')) {
                        $smtpDiag = 'smtp_starttls_failed';
                    } elseif (in_array($expCode, [334, 235])) {
                        $smtpDiag = 'smtp_auth_failed';
                    } elseif ($expCode === 354) {
                        $smtpDiag = 'smtp_message_rejected';
                    } elseif ($expCode === 250) {
                        preg_match('/got: (\d{3})/', $errMsg, $gotM);
                        $gotCode = (int)($gotM[1] ?? 0);
                        $smtpDiag = ($gotCode >= 550 && $gotCode <= 553)
                            ? 'smtp_recipient_rejected'
                            : 'smtp_message_rejected';
                    } else {
                        $smtpDiag = 'smtp_error';
                    }
                }
            } else {
                $smtpDiag = 'smtp_config_missing';
                error_log('[invite:B:skip] SMTP config incomplete — not sending email');
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
        'smtp_diag'    => $smtpDiag,
    ], 201);
}

dolphin_send_json(['error' => 'GET, PATCH, or POST only'], 405);
