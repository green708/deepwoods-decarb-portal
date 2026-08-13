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

    // Mark payment_complete when status transitions to 'paid' or 'waived'
    $newPaymentStatus  = $body['payment_status'] ?? null;
    $wasAlreadyCleared = in_array($prevPaymentStatus, ['paid', 'waived'], true);
    if (in_array($newPaymentStatus, ['paid', 'waived'], true) && !$wasAlreadyCleared) {
        // Backend-authoritative gate: set payment_complete so frontend can unlock features
        $pdo->prepare(
            'INSERT INTO client_config (client_id, config_key, config_value)
             VALUES (?, \'payment_complete\', \'true\')
             ON DUPLICATE KEY UPDATE config_value = \'true\''
        )->execute([$clientId]);

        // Get all client users to notify
        $userStmt = $pdo->prepare('SELECT email FROM users WHERE client_id = ? AND email IS NOT NULL');
        $userStmt->execute([$clientId]);
        $clientUsers = $userStmt->fetchAll(PDO::FETCH_COLUMN);

        $config  = dolphin_config();
        $baseUrl = rtrim($config['app_base_url'] ?? $config['platform_base_url'] ?? 'https://decarb.sustainablyyours.me', '/');
        $smtpCfg = $config['smtp'] ?? [];

        if (
            !empty($clientUsers) &&
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
                $clientNameHtml = htmlspecialchars($existingClient['name']);
                $htmlBody = <<<HTML
<html><body style="font-family:Arial,sans-serif;color:#1a1a1a;max-width:560px;margin:0 auto;padding:24px">
<h2 style="color:#1E6F5C;margin-top:0">&#10003; Payment confirmed — full portal access</h2>
<p>Hello,</p>
<p>We've received your payment for <strong>{$clientNameHtml}</strong>. Your GHG Portal account now has full access and your engagement is officially underway!</p>
<p>You can now:</p>
<ul style="padding-left:20px;font-size:14px;line-height:1.8;color:#374151">
  <li>Submit data across all emission scopes</li>
  <li>View your carbon footprint dashboard</li>
  <li>Access decarbonisation planning tools</li>
  <li>Download reports from the document vault</li>
</ul>
<p style="margin-top:24px">
  <a href="{$baseUrl}" style="display:inline-block;background:#1E6F5C;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px">Open your portal</a>
</p>
<p style="font-size:13px;color:#6B7280;margin-top:16px">Your Deepwoods consultant will be in touch shortly to kick off the data collection phase. If you have any questions, reply to this email.</p>
<p style="font-size:12px;color:#9CA3AF;margin-top:32px;border-top:1px solid #F3F4F6;padding-top:16px">— Deepwoods GHG Portal · This is an automated message.</p>
</body></html>
HTML;
                foreach ($clientUsers as $userEmail) {
                    try {
                        $smtp->send($userEmail, "Payment confirmed — your GHG Portal is ready", $htmlBody);
                    } catch (Throwable $e) {
                        error_log('activate-client payment email failed for ' . $userEmail . ': ' . $e->getMessage());
                    }
                }
            } catch (Throwable $e) {
                error_log('activate-client SMTP init failed: ' . $e->getMessage());
            }
        }
    }

    dolphin_send_json(['ok' => true, 'client_id' => $clientId]);
}

dolphin_send_json(['error' => 'GET, POST, or PATCH only'], 405);
