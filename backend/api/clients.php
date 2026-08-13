<?php
// clients.php — GET / POST / PATCH /backend/api/clients.php
// Deepwoods staff: list and provision client accounts.
//
// GET             → list all clients with engagement metadata (admin + coordinator)
// POST { name, slug?, currency?, reporting_period?, entities?, config? }
//                 → create client + entities + default config atomically (admin only)
// PATCH { id, name?, logo_url?, primary_color?, currency?, reporting_period? }
//                 → update client metadata (admin only)

declare(strict_types=1);
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/Smtp.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Allow-Methods: GET, POST, PATCH, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$authUser = dolphin_require_auth();

$isAdmin = $authUser['role'] === 'deepwoods_admin';
$isStaff = in_array($authUser['role'], ['deepwoods_admin', 'deepwoods_coordinator'], true);

if (!$isStaff) {
    dolphin_send_json(['error' => 'Deepwoods staff role required'], 403);
}

$pdo    = dolphin_db();
$method = $_SERVER['REQUEST_METHOD'];

// ── GET — list all clients ────────────────────────────────────────────────────

if ($method === 'GET') {
    $stmt = $pdo->query(
        "SELECT c.id, c.name, c.slug, c.logo_url, c.primary_color,
                c.currency, c.reporting_period, c.is_active, c.activated_at, c.created_at,
                (SELECT cc.config_value FROM client_config cc
                 WHERE cc.client_id = c.id AND cc.config_key = 'setup_complete') AS setup_complete,
                (SELECT cc.config_value FROM client_config cc
                 WHERE cc.client_id = c.id AND cc.config_key = 'industry') AS industry,
                (SELECT cc.config_value FROM client_config cc
                 WHERE cc.client_id = c.id AND cc.config_key = 'consolidation_approach') AS consolidation_approach,
                (SELECT COUNT(*) FROM users u WHERE u.client_id = c.id) AS user_count,
                (SELECT COUNT(*) FROM client_entities ce WHERE ce.client_id = c.id) AS entity_count
         FROM clients c
         ORDER BY c.created_at DESC"
    );
    $rows = $stmt->fetchAll();
    foreach ($rows as &$r) {
        $r['id']           = (int)$r['id'];
        $r['is_active']    = (bool)$r['is_active'];
        $r['user_count']   = (int)$r['user_count'];
        $r['entity_count'] = (int)$r['entity_count'];
    }
    unset($r);
    dolphin_send_json($rows);
}

// ── POST — create new client ──────────────────────────────────────────────────

if ($method === 'POST') {
    if (!$isAdmin) {
        dolphin_send_json(['error' => 'deepwoods_admin role required to create clients'], 403);
    }

    $body = dolphin_json_body();

    $name = trim($body['name'] ?? '');
    if ($name === '') {
        dolphin_send_json(['error' => 'name is required'], 400);
    }

    // Auto-derive slug from name if not supplied
    $slug = trim($body['slug'] ?? '');
    if ($slug === '') {
        $slug = strtolower(preg_replace('/[^a-z0-9]+/i', '-', $name));
    }
    $slug = strtolower(preg_replace('/[^a-z0-9-]/', '', $slug));
    $slug = preg_replace('/-+/', '-', trim($slug, '-'));

    if ($slug === '') {
        dolphin_send_json(['error' => 'Could not derive a valid slug from the name provided'], 400);
    }

    $currency        = in_array($body['currency'] ?? '', ['INR', 'USD', 'EUR', 'GBP'], true)
                       ? $body['currency'] : 'INR';
    $reportingPeriod = in_array($body['reporting_period'] ?? '', ['FY', 'CY'], true)
                       ? $body['reporting_period'] : 'FY';
    $primaryColor    = preg_match('/^#[0-9a-fA-F]{6}$/', $body['primary_color'] ?? '')
                       ? $body['primary_color'] : '#1E6F5C';
    $logoUrl         = trim($body['logo_url'] ?? '/deepwoods-logo.png');

    $inviteEmail = trim($body['invite_email'] ?? '');
    $inviteRole  = in_array($body['invite_role'] ?? '', ['sustainability_team', 'client_uploader', 'client_leadership'], true)
                   ? $body['invite_role'] : 'sustainability_team';

    $entities = is_array($body['entities'] ?? null) ? $body['entities'] : [];
    $config   = is_array($body['config']   ?? null) ? $body['config']   : [];

    try {
        $pdo->beginTransaction();

        // Create the client row; activated immediately
        $stmt = $pdo->prepare(
            'INSERT INTO clients (name, slug, logo_url, primary_color, currency, reporting_period, is_active, activated_at)
             VALUES (?, ?, ?, ?, ?, ?, 1, NOW())'
        );
        $stmt->execute([$name, $slug, $logoUrl, $primaryColor, $currency, $reportingPeriod]);
        $clientId = (int)$pdo->lastInsertId();

        // Create entities
        $insertEntity = $pdo->prepare(
            'INSERT IGNORE INTO client_entities (client_id, code, name, short_name, is_consolidated, sort_order)
             VALUES (?, ?, ?, ?, ?, ?)'
        );
        foreach ($entities as $i => $ent) {
            $code  = strtoupper(trim($ent['code']  ?? ''));
            $ename = trim($ent['name']       ?? '');
            $short = trim($ent['short_name'] ?? $code);
            $isConsolidated = !empty($ent['is_consolidated']) ? 1 : 0;
            if ($code === '' || $ename === '') continue;
            $insertEntity->execute([$clientId, $code, $ename, $short, $isConsolidated, $i + 1]);
        }

        // Default config
        $defaultConfig = array_merge(['setup_complete' => 'false'], $config);
        if ($inviteEmail !== '') {
            $defaultConfig['contact_email'] = $inviteEmail;
        }
        $upsertConfig = $pdo->prepare(
            'INSERT INTO client_config (client_id, config_key, config_value)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)'
        );
        foreach ($defaultConfig as $key => $value) {
            if ($value !== null && (string)$value !== '') {
                $upsertConfig->execute([$clientId, (string)$key, (string)$value]);
            }
        }

        $pdo->commit();

    } catch (PDOException $e) {
        $pdo->rollBack();
        if ($e->getCode() === '23000') {
            dolphin_send_json(['error' => 'A client with that slug already exists'], 409);
        }
        error_log('clients.php POST error: ' . $e->getMessage());
        dolphin_send_json(['error' => 'Failed to create client. Please try again.'], 500);
    }

    // Create user + send welcome email (outside transaction so client row is committed first)
    $tempPassword = null;
    $emailSent    = false;
    if (filter_var($inviteEmail, FILTER_VALIDATE_EMAIL)) {
        $tempPassword = bin2hex(random_bytes(8));
        $hash = password_hash($tempPassword, PASSWORD_BCRYPT);
        try {
            $pdo->prepare(
                'INSERT INTO users (client_id, email, password_hash, role, must_change_password)
                 VALUES (?, ?, ?, ?, 1)
                 ON DUPLICATE KEY UPDATE client_id = VALUES(client_id), role = VALUES(role), must_change_password = 1'
            )->execute([$clientId, $inviteEmail, $hash, $inviteRole]);
        } catch (Throwable $e) {
            error_log('clients.php user insert failed: ' . $e->getMessage());
        }

        $config  = dolphin_config();
        $baseUrl = rtrim($config['app_base_url'] ?? $config['platform_base_url'] ?? 'https://decarb.sustainablyyours.me', '/');
        $smtpCfg = $config['smtp'] ?? [];

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
                $emailHtml = htmlspecialchars($inviteEmail);
                $htmlBody = <<<HTML
<html><body style="font-family:Arial,sans-serif;color:#1a1a1a;max-width:560px;margin:0 auto;padding:24px">
<h2 style="color:#1E6F5C;margin-top:0">Welcome to the Deepwoods GHG Portal</h2>
<p>Hello,</p>
<p>Your GHG Portal account for <strong>{$clientNameHtml}</strong> is ready. Here are your login credentials:</p>
<table style="border-collapse:collapse;width:100%;font-size:14px;margin:16px 0">
  <tr><td style="padding:8px 12px;background:#F3F4F6;border-radius:4px 4px 0 0;font-weight:600;color:#374151">Login email</td><td style="padding:8px 12px;background:#F9FAFB">{$emailHtml}</td></tr>
  <tr><td style="padding:8px 12px;background:#F3F4F6;font-weight:600;color:#374151">Temporary password</td><td style="padding:8px 12px;background:#F9FAFB;font-family:monospace">{$tempPassword}</td></tr>
</table>
<p style="font-size:13px;color:#6B7280">You will be asked to change your password on first login.</p>
<p style="margin-top:24px">
  <a href="{$baseUrl}" style="display:inline-block;background:#1E6F5C;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px">Open your portal</a>
</p>
<p style="font-size:12px;color:#9CA3AF;margin-top:32px;border-top:1px solid #F3F4F6;padding-top:16px">— Deepwoods GHG Portal · This is an automated message.</p>
</body></html>
HTML;
                $smtp->send($inviteEmail, "Your GHG Portal account is ready — {$name}", $htmlBody);
                $emailSent = true;
            } catch (Throwable $e) {
                error_log('clients.php welcome email failed: ' . $e->getMessage());
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

// ── PATCH — update client metadata ────────────────────────────────────────────

if ($method === 'PATCH') {
    if (!$isAdmin) {
        dolphin_send_json(['error' => 'deepwoods_admin role required to update clients'], 403);
    }

    $body     = dolphin_json_body();
    $clientId = (int)($body['id'] ?? 0);
    if (!$clientId) {
        dolphin_send_json(['error' => 'id is required'], 400);
    }

    $updates = [];
    $params  = [];

    if (isset($body['name'])) {
        $updates[] = 'name = ?';
        $params[]  = trim($body['name']);
    }
    if (isset($body['logo_url'])) {
        $updates[] = 'logo_url = ?';
        $params[]  = trim($body['logo_url']);
    }
    if (isset($body['primary_color']) && preg_match('/^#[0-9a-fA-F]{6}$/', $body['primary_color'])) {
        $updates[] = 'primary_color = ?';
        $params[]  = $body['primary_color'];
    }
    if (isset($body['currency']) && in_array($body['currency'], ['INR', 'USD', 'EUR', 'GBP'], true)) {
        $updates[] = 'currency = ?';
        $params[]  = $body['currency'];
    }
    if (isset($body['reporting_period']) && in_array($body['reporting_period'], ['FY', 'CY'], true)) {
        $updates[] = 'reporting_period = ?';
        $params[]  = $body['reporting_period'];
    }

    if (empty($updates)) {
        dolphin_send_json(['error' => 'No updatable fields provided'], 400);
    }

    $params[] = $clientId;
    $pdo->prepare('UPDATE clients SET ' . implode(', ', $updates) . ' WHERE id = ?')
        ->execute($params);

    dolphin_send_json(['ok' => true]);
}

dolphin_send_json(['error' => 'GET, POST, or PATCH only'], 405);
