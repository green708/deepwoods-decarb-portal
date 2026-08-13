<?php
// activate-client.php — GET / POST / PATCH /backend/api/activate-client.php
// Deepwoods admin only: list clients and activate/deactivate them.
//
// GET                                          → list all clients with activation + invoice status
// POST { client_id, active: true|false }       → set is_active flag (and activated_at)
// PATCH { client_id, invoice_ref?, payment_status?, payment_date?, payment_notes? }
//                                              → update invoice / payment fields

declare(strict_types=1);
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/Smtp.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Allow-Methods: GET, POST, PATCH, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$authUser = dolphin_require_auth();
if ($authUser['role'] !== 'deepwoods_admin') {
    dolphin_send_json(['error' => 'deepwoods_admin role required'], 403);
}

$pdo    = dolphin_db();
$method = $_SERVER['REQUEST_METHOD'];

// ── GET — list all clients ────────────────────────────────────────────────────

if ($method === 'GET') {
    $stmt = $pdo->query(
        "SELECT c.id, c.name, c.slug, c.is_active, c.activated_at, c.created_at,
                c.invoice_ref, c.payment_status, c.payment_date, c.payment_notes,
                (SELECT COUNT(*) FROM users u WHERE u.client_id = c.id) AS user_count,
                (SELECT cc.config_value FROM client_config cc
                 WHERE cc.client_id = c.id AND cc.config_key = 'setup_complete') AS setup_complete,
                (SELECT cc2.config_value FROM client_config cc2
                 WHERE cc2.client_id = c.id AND cc2.config_key = 'ghg_setup_done') AS ghg_setup_done,
                (SELECT cc3.config_value FROM client_config cc3
                 WHERE cc3.client_id = c.id AND cc3.config_key = 'contact_email') AS contact_email,
                (SELECT cc4.config_value FROM client_config cc4
                 WHERE cc4.client_id = c.id AND cc4.config_key = 'payment_requested') AS payment_requested,
                (SELECT cc5.config_value FROM client_config cc5
                 WHERE cc5.client_id = c.id AND cc5.config_key = 'payment_complete') AS payment_complete
         FROM clients c
         ORDER BY c.created_at DESC"
    );
    $rows = $stmt->fetchAll();
    foreach ($rows as &$r) {
        $r['id']         = (int)$r['id'];
        $r['is_active']  = (bool)$r['is_active'];
        $r['user_count'] = (int)$r['user_count'];
    }
    unset($r);
    dolphin_send_json($rows);
}

// ── POST — activate or deactivate a client ────────────────────────────────────

if ($method === 'POST') {
    $body     = dolphin_json_body();
    $clientId = isset($body['client_id']) ? (int)$body['client_id'] : 0;
    $activate = isset($body['active']) ? (bool)$body['active'] : true;

    if (!$clientId) {
        dolphin_send_json(['error' => 'client_id is required'], 400);
    }

    $stmt = $pdo->prepare('SELECT id, name FROM clients WHERE id = ?');
    $stmt->execute([$clientId]);
    $client = $stmt->fetch();
    if (!$client) {
        dolphin_send_json(['error' => 'Client not found'], 404);
    }

    if ($activate) {
        $pdo->prepare(
            'UPDATE clients SET is_active = 1, activated_at = NOW() WHERE id = ?'
        )->execute([$clientId]);
    } else {
        $pdo->prepare(
            'UPDATE clients SET is_active = 0 WHERE id = ?'
        )->execute([$clientId]);
    }

    dolphin_send_json([
        'ok'        => true,
        'client_id' => $clientId,
        'is_active' => $activate,
        'name'      => $client['name'],
    ]);
}

// ── PATCH — update invoice / payment fields ───────────────────────────────────

if ($method === 'PATCH') {
    $body     = dolphin_json_body();
    $clientId = isset($body['client_id']) ? (int)$body['client_id'] : 0;

    if (!$clientId) {
        dolphin_send_json(['error' => 'client_id is required'], 400);
    }

    $stmt = $pdo->prepare('SELECT id, name, payment_status FROM clients WHERE id = ?');
    $stmt->execute([$clientId]);
    $existingClient = $stmt->fetch();
    if (!$existingClient) {
        dolphin_send_json(['error' => 'Client not found'], 404);
    }
    $prevPaymentStatus = $existingClient['payment_status'] ?? 'pending';

    $allowed = ['invoice_ref', 'payment_status', 'payment_date', 'payment_notes'];
    $validStatuses = ['pending', 'paid', 'waived'];

    $setClauses = [];
    $params     = [];

    foreach ($allowed as $field) {
        if (!array_key_exists($field, $body)) continue;

        $val = $body[$field];

        if ($field === 'payment_status') {
            if (!in_array($val, $validStatuses, true)) {
                dolphin_send_json(['error' => "payment_status must be one of: " . implode(', ', $validStatuses)], 400);
            }
        }

        if ($field === 'payment_date' && $val !== null) {
            // Accept YYYY-MM-DD only
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)$val)) {
                dolphin_send_json(['error' => 'payment_date must be YYYY-MM-DD or null'], 400);
            }
        }

        $setClauses[] = "`{$field}` = ?";
        $params[]     = ($val === '' || $val === null) ? null : $val;
    }

    if (empty($setClauses)) {
        dolphin_send_json(['error' => 'No valid fields to update'], 400);
    }

    $params[] = $clientId;
    $pdo->prepare("UPDATE clients SET " . implode(', ', $setClauses) . " WHERE id = ?")->execute($params);

    // ── Access-activation on real state transition (pending → paid|waived) ────────
    $newPaymentStatus  = $body['payment_status'] ?? null;
    $wasAlreadyUnlocked = in_array($prevPaymentStatus, ['paid', 'waived'], true);
    $isActivation       = in_array($newPaymentStatus, ['paid', 'waived'], true) && !$wasAlreadyUnlocked;

    $emailSent = false;

    if ($isActivation) {
        // 1. Set payment_complete = true in client_config (backend-authoritative gate)
        $pdo->prepare(
            'INSERT INTO client_config (client_id, config_key, config_value)
             VALUES (?, \'payment_complete\', \'true\')
             ON DUPLICATE KEY UPDATE config_value = \'true\''
        )->execute([$clientId]);

        // 2. Set activated_at if not already stamped
        $pdo->prepare(
            'UPDATE clients SET activated_at = NOW() WHERE id = ? AND activated_at IS NULL'
        )->execute([$clientId]);

        // 3. Find primary user: first sustainability_team account for this client,
        //    fall back to contact_email stored in client_config during onboarding.
        $primaryEmail = null;
        $primaryStmt  = $pdo->prepare(
            "SELECT email FROM users
             WHERE client_id = ? AND role = 'sustainability_team'
             ORDER BY id ASC LIMIT 1"
        );
        $primaryStmt->execute([$clientId]);
        $primaryRow = $primaryStmt->fetch();
        if ($primaryRow) {
            $primaryEmail = $primaryRow['email'];
        } else {
            $contactStmt = $pdo->prepare(
                "SELECT config_value FROM client_config
                 WHERE client_id = ? AND config_key = 'contact_email' LIMIT 1"
            );
            $contactStmt->execute([$clientId]);
            $primaryEmail = $contactStmt->fetchColumn() ?: null;
        }

        // 4. Send B2B access-activation email (non-fatal on failure)
        if ($primaryEmail && filter_var($primaryEmail, FILTER_VALIDATE_EMAIL)) {
            $config  = dolphin_config();
            $smtpCfg = $config['smtp'] ?? [];
            $portalUrl = 'https://decarb.deepwoodsgreen.com';

            if (!empty($smtpCfg['host']) && !empty($smtpCfg['username']) && !empty($smtpCfg['app_password'])) {
                try {
                    $smtp = new Smtp(
                        $smtpCfg['host'],
                        (int)($smtpCfg['port'] ?? 587),
                        $smtpCfg['username'],
                        $smtpCfg['app_password'],
                        $smtpCfg['from_email'] ?? $smtpCfg['username'],
                        $smtpCfg['from_name']  ?? 'Deepwoods Sustainability Team',
                    );

                    $orgName = htmlspecialchars($existingClient['name']);
                    $htmlBody = <<<HTML
<!DOCTYPE html>
<html lang="en"><body style="margin:0;padding:0;background:#F3F4F6;font-family:Arial,Helvetica,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:40px 16px">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08)">

  <!-- Header -->
  <tr><td style="background:#1E6F5C;padding:28px 40px">
    <p style="margin:0;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.7)">Deepwoods Green</p>
    <p style="margin:6px 0 0;font-size:20px;font-weight:700;color:#ffffff">Decarb Portal</p>
  </td></tr>

  <!-- Body -->
  <tr><td style="padding:36px 40px 28px">
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#111827">Hello,</p>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#111827">
      We are pleased to confirm that your organisation's access to the <strong>Deepwoods Decarb Portal</strong> is now active.
    </p>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#111827">
      Your account has been successfully activated. You can now access your organisation's sustainability workspace, including:
    </p>
    <ul style="margin:0 0 24px;padding-left:20px;font-size:14px;line-height:1.9;color:#374151">
      <li>GHG inventory data collection — Scope 1, 2 and 3</li>
      <li>Facility-level data submission and document vault</li>
      <li>Carbon footprint dashboards and intensity metrics</li>
      <li>Decarbonisation pathway and peer benchmarking</li>
      <li>Assured report generation aligned to GHG Protocol</li>
    </ul>

    <!-- CTA -->
    <table cellpadding="0" cellspacing="0" style="margin:28px 0">
      <tr><td style="border-radius:8px;background:#1E6F5C">
        <a href="{$portalUrl}"
           style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.01em">
          Access Your Decarb Portal &rarr;
        </a>
      </td></tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;margin-bottom:24px">
      <tr><td style="padding:14px 18px">
        <p style="margin:0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#6B7280">Organisation</p>
        <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#111827">{$orgName}</p>
      </td></tr>
    </table>

    <p style="margin:0 0 16px;font-size:14px;line-height:1.65;color:#374151">
      Please use your existing login credentials to access the portal. If you have not yet completed your initial password setup, you will be prompted to do so when signing in.
    </p>
    <p style="margin:0 0 8px;font-size:14px;line-height:1.65;color:#374151">
      For support or questions, please contact your Deepwoods account manager.
    </p>
  </td></tr>

  <!-- Signature -->
  <tr><td style="padding:0 40px 28px">
    <p style="margin:0;font-size:14px;color:#374151">Regards,</p>
    <p style="margin:4px 0 0;font-size:14px;font-weight:700;color:#111827">Deepwoods Sustainability Team</p>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#F9FAFB;border-top:1px solid #E5E7EB;padding:16px 40px">
    <p style="margin:0;font-size:11px;color:#9CA3AF">
      Deepwoods Green &nbsp;&middot;&nbsp; <a href="{$portalUrl}" style="color:#9CA3AF">{$portalUrl}</a>
      &nbsp;&middot;&nbsp; This is an automated message. Please do not reply directly to this email.
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>
HTML;
                    $smtp->send(
                        $primaryEmail,
                        'Your Decarb Portal Access Is Now Active',
                        $htmlBody
                    );
                    $emailSent = true;
                } catch (Throwable $e) {
                    error_log('activate-client: access-activation email failed for ' . $primaryEmail . ': ' . $e->getMessage());
                }
            }
        }
    }

    dolphin_send_json([
        'ok'             => true,
        'client_id'      => $clientId,
        'was_activation' => $isActivation,
        'email_sent'     => $emailSent,
    ]);
}

dolphin_send_json(['error' => 'GET, POST, or PATCH only'], 405);
