<?php
// ndc-threads.php — Q&A threads for the NDC data collection page.
//
// GET  ?fy=FY26
//      → summary map: { [source_id]: { count, has_open } }
//        has_open = true when last message was from Deepwoods (client needs to respond)
//
// GET  ?fy=FY26&source_type=scope12&source_id=inv-s1-f1-dg
//      → full thread list with messages for one source
//
// POST { action:'create', source_type, source_id, fy, message }
//      → create a new thread with the first message
//
// POST { action:'reply', thread_id, message }
//      → add a reply to an existing thread
//      → deepwoods_admin/coordinator can pass from_role:'deepwoods'

declare(strict_types=1);
require_once __DIR__ . '/db.php';

// ── Email helper ───────────────────────────────────────────────────────────────
// Sends one notification after a thread create or reply.
// Failure is silently swallowed so it never blocks the API response.
function ndc_send_notification(PDO $pdo, int $clientId, string $fromRole, string $author, string $sourceId, string $fy, string $message, string $action): void {
    $cfg = dolphin_config();
    $smtpCfg = $cfg['smtp'] ?? [];
    if (empty($smtpCfg['host']) || empty($smtpCfg['username']) || empty($smtpCfg['app_password'])) {
        return; // SMTP not configured
    }
    require_once __DIR__ . '/Smtp.php';

    $smtp = new Smtp(
        $smtpCfg['host'],
        (int)($smtpCfg['port'] ?? 587),
        $smtpCfg['username'],
        $smtpCfg['app_password'],
        $smtpCfg['from_email'] ?? $smtpCfg['username'],
        $smtpCfg['from_name']  ?? 'Deepwoods Decarbonisation Portal',
    );

    // Look up client name
    $cs = $pdo->prepare('SELECT name FROM clients WHERE id = ?');
    $cs->execute([$clientId]);
    $clientName = (string)($cs->fetchColumn() ?: 'Your client');

    $baseUrl   = rtrim($cfg['app_base_url'] ?? $cfg['platform_base_url'] ?? 'https://decarb.deepwoodsgreen.com', '/');
    $testEmail = $cfg['notification_test_email'] ?? '';
    $preview   = mb_substr($message, 0, 160);
    $ellipsis  = mb_strlen($message) > 160 ? '…' : '';
    $verb      = $action === 'create' ? 'opened a new query thread' : 'replied to a query thread';

    $previewHtml = nl2br(htmlspecialchars($preview, ENT_QUOTES)) . htmlspecialchars($ellipsis);

    if ($fromRole === 'client') {
        // Client acted → notify all Deepwoods staff.
        //
        // Primary TO: every user with deepwoods_admin or deepwoods_coordinator role in the DB.
        // Extra TO:   any addresses listed in config['dw_notification_emails'] (array of strings)
        //             — add data@deepwoodsgreen.com there for staff without a portal account.
        // CC:         notification_test_email (oversight inbox).
        // Fallback:   if DB has no DW users, use config['admin_email'].

        $dwStmt = $pdo->prepare(
            "SELECT email FROM users
             WHERE role IN ('deepwoods_admin', 'deepwoods_coordinator')
             AND client_id IS NULL"
        );
        $dwStmt->execute();
        $dwEmails = $dwStmt->fetchAll(PDO::FETCH_COLUMN);   // all portal DW users

        // Extra fixed addresses from config (no portal account required)
        $extraDW = $cfg['dw_notification_emails'] ?? [];
        if (is_string($extraDW)) { $extraDW = [$extraDW]; }
        foreach ($extraDW as $e) {
            if (filter_var($e, FILTER_VALIDATE_EMAIL) && !in_array($e, $dwEmails, true)) {
                $dwEmails[] = $e;
            }
        }

        // Fallback: config admin_email if nothing else
        $adminEmail = $cfg['admin_email'] ?? '';
        if (empty($dwEmails) && $adminEmail) {
            $dwEmails[] = $adminEmail;
        }

        // Build CC (test/oversight inbox only — DW staff are all TO)
        $dwCc = [];
        if ($testEmail && !in_array($testEmail, $dwEmails, true)) {
            $dwCc[] = $testEmail;
        }

        $subject = "[NDC Query] {$clientName} — {$sourceId} ({$fy})";
        $body = <<<HTML
<p style="font-family:sans-serif;font-size:14px;color:#222;">
  A client has <strong>{$verb}</strong> on the Decarb Portal.
</p>
<table cellpadding="6" style="font-family:sans-serif;font-size:13px;color:#444;border-collapse:collapse;">
  <tr><td><strong>Client</strong></td><td>{$clientName}</td></tr>
  <tr><td><strong>Source</strong></td><td>{$sourceId}</td></tr>
  <tr><td><strong>FY</strong></td><td>{$fy}</td></tr>
  <tr><td><strong>From</strong></td><td>{$author}</td></tr>
</table>
<blockquote style="border-left:3px solid #1E6F5C;margin:16px 0;padding:8px 16px;color:#444;background:#f4f9f7;font-family:sans-serif;font-size:13px;">
  {$previewHtml}
</blockquote>
<p><a href="{$baseUrl}/admin" style="background:#1E6F5C;color:#fff;padding:9px 20px;border-radius:6px;text-decoration:none;font-family:sans-serif;font-weight:bold;font-size:13px;display:inline-block;">Open Admin Query Inbox</a></p>
HTML;
        if (!empty($dwEmails)) {
            try { $smtp->send($dwEmails, $subject, $body, $dwCc); } catch (\Throwable) {}
        }
    } else {
        // DW acted → email the entity admin (TO) and CC the org admin + all other roles.
        //
        // For scope12 threads: look up which entity the asset belongs to, then find
        // the sustainability_team user scoped to that entity.
        // For scope3 threads: no per-entity scope — treat all sustainability_team
        // users as co-primary (all get TO).
        //
        // Everyone else on the client (org-level sustainability_team, client_leadership,
        // client_uploader) is CC'd so they stay in the loop without cluttering the TO.

        // 1. Resolve entity scope for scope12 sources
        $assetEntity = null;
        // source_type is not passed to the helper — detect by source_id pattern.
        // scope12 asset IDs come from decarb_assets; scope3 IDs are c1–c15.
        if (!preg_match('/^c\d+$/', $sourceId)) {
            $ae = $pdo->prepare('SELECT entity FROM decarb_assets WHERE client_id = ? AND asset_id = ?');
            $ae->execute([$clientId, $sourceId]);
            $assetEntity = $ae->fetchColumn() ?: null;
        }

        // 2. Fetch all client users
        $us = $pdo->prepare(
            'SELECT email, role, entity_scope FROM users WHERE client_id = ?'
        );
        $us->execute([$clientId]);
        $allUsers = $us->fetchAll(); // [email, role, entity_scope]

        // 3. Partition into TO (entity admins) and CC (everyone else)
        $toEmails = [];
        $ccEmails = [];
        foreach ($allUsers as $u) {
            $uEmail  = (string)$u['email'];
            $uRole   = (string)$u['role'];
            $uScope  = $u['entity_scope'] !== null ? (string)$u['entity_scope'] : null;

            if ($uRole === 'sustainability_team') {
                if ($assetEntity !== null) {
                    // scope12: entity admin = sustainability_team user scoped to that entity
                    if ($uScope === $assetEntity) {
                        $toEmails[] = $uEmail;
                    } else {
                        // org-level or different-entity sustainability_team → CC
                        $ccEmails[] = $uEmail;
                    }
                } else {
                    // scope3 or unknown: all sustainability_team get TO
                    $toEmails[] = $uEmail;
                }
            } else {
                // client_leadership, client_uploader → always CC
                $ccEmails[] = $uEmail;
            }
        }

        // If no entity-scoped TO was found (e.g. no dedicated entity user set up),
        // fall back to all sustainability_team users as TO.
        if (empty($toEmails)) {
            foreach ($allUsers as $u) {
                if ($u['role'] === 'sustainability_team') {
                    $toEmails[] = (string)$u['email'];
                }
            }
            $ccEmails = array_diff($ccEmails, $toEmails);
        }

        // Add notification_test_email as CC (oversight inbox) if not already present
        if ($testEmail && !in_array($testEmail, $toEmails, true) && !in_array($testEmail, $ccEmails, true)) {
            $ccEmails[] = $testEmail;
        }

        if (empty($toEmails)) {
            return; // No client users to notify
        }

        $subject = "[Deepwoods] Reply on your data query — {$sourceId} ({$fy})";
        $body = <<<HTML
<p style="font-family:sans-serif;font-size:14px;color:#222;">
  The Deepwoods team has <strong>{$verb}</strong> on the Decarb Portal.
</p>
<table cellpadding="6" style="font-family:sans-serif;font-size:13px;color:#444;border-collapse:collapse;">
  <tr><td><strong>Source</strong></td><td>{$sourceId}</td></tr>
  <tr><td><strong>FY</strong></td><td>{$fy}</td></tr>
</table>
<blockquote style="border-left:3px solid #1E6F5C;margin:16px 0;padding:8px 16px;color:#444;background:#f4f9f7;font-family:sans-serif;font-size:13px;">
  {$previewHtml}
</blockquote>
<p><a href="{$baseUrl}/submissions" style="background:#1E6F5C;color:#fff;padding:9px 20px;border-radius:6px;text-decoration:none;font-family:sans-serif;font-weight:bold;font-size:13px;display:inline-block;">Open Data Submissions</a></p>
HTML;

        // Send one email: entity admin(s) in To:, org admin + other roles in CC:.
        try { $smtp->send($toEmails, $subject, $body, $ccEmails); } catch (\Throwable) {}
    }
}

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$user     = dolphin_require_auth();
$role     = $user['role'] ?? '';
$email    = $user['email'] ?? 'unknown';
$isDW     = in_array($role, ['deepwoods_admin', 'deepwoods_coordinator'], true);
$clientId = (int)($user['client_id'] ?? 0);

$pdo = dolphin_db();

// All-clients summary (Deepwoods staff only) — served before the per-client
// client_id check so DW users (who have no client_id) can call it freely.
if ($_SERVER['REQUEST_METHOD'] === 'GET' && !empty($_GET['all_clients']) && $isDW) {
    $fy = trim($_GET['fy'] ?? '');
    if (!$fy) { dolphin_send_json(['error' => 'fy required'], 400); }
    $stmt = $pdo->prepare(
        'SELECT client_id,
                COUNT(*) AS cnt,
                SUM(last_from_role = "client") AS open_count
         FROM ndc_threads
         WHERE fy = ?
         GROUP BY client_id'
    );
    $stmt->execute([$fy]);
    $rows     = $stmt->fetchAll();
    $byClient = [];
    $totalOpen = 0;
    foreach ($rows as $r) {
        $byClient[$r['client_id']] = [
            'count'      => (int)$r['cnt'],
            'open_count' => (int)$r['open_count'],
        ];
        $totalOpen += (int)$r['open_count'];
    }
    dolphin_send_json(['total_open' => $totalOpen, 'by_client' => $byClient]);
}

// Deepwoods staff can pass ?client_id= to view a specific client's threads.
if (!$clientId) {
    if ($isDW && !empty($_GET['client_id'])) {
        $clientId = (int)$_GET['client_id'];
    } elseif ($isDW && !empty($_SERVER['CONTENT_TYPE'])) {
        $body = dolphin_json_body();
        $clientId = (int)($body['client_id'] ?? 0);
    }
}
if (!$clientId) {
    dolphin_send_json(['error' => 'No client context'], 403);
}

// ── GET ────────────────────────────────────────────────────────────────────────

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $fy         = trim($_GET['fy']          ?? '');
    $sourceType = trim($_GET['source_type'] ?? '');
    $sourceId   = trim($_GET['source_id']   ?? '');

    if (!$fy) { dolphin_send_json(['error' => 'fy required'], 400); }

    if ($sourceType && $sourceId) {
        // Full thread detail for one source
        $threadStmt = $pdo->prepare(
            'SELECT id, last_from_role, created_by, created_at
             FROM ndc_threads
             WHERE client_id = ? AND source_type = ? AND source_id = ? AND fy = ?
             ORDER BY created_at ASC'
        );
        $threadStmt->execute([$clientId, $sourceType, $sourceId, $fy]);
        $threads = $threadStmt->fetchAll();

        $msgStmt = $pdo->prepare(
            'SELECT id, thread_id, from_role, author, message, created_at
             FROM ndc_thread_messages
             WHERE thread_id = ?
             ORDER BY created_at ASC'
        );

        $result = [];
        foreach ($threads as $t) {
            $msgStmt->execute([(int)$t['id']]);
            $result[] = [
                'id'             => (int)$t['id'],
                'last_from_role' => $t['last_from_role'],
                'created_by'     => $t['created_by'],
                'created_at'     => $t['created_at'],
                'messages'       => $msgStmt->fetchAll(),
            ];
        }
        dolphin_send_json($result);
    } else {
        // Summary map for all sources in this FY
        // has_open = last message from 'deepwoods' (client should respond)
        $stmt = $pdo->prepare(
            'SELECT source_id,
                    COUNT(*) AS cnt,
                    SUM(last_from_role = "deepwoods") AS open_count
             FROM ndc_threads
             WHERE client_id = ? AND fy = ?
             GROUP BY source_id'
        );
        $stmt->execute([$clientId, $fy]);
        $rows = $stmt->fetchAll();

        $summary = [];
        foreach ($rows as $r) {
            $summary[$r['source_id']] = [
                'count'    => (int)$r['cnt'],
                'has_open' => (int)$r['open_count'] > 0,
            ];
        }
        dolphin_send_json($summary);
    }
}

// ── POST ───────────────────────────────────────────────────────────────────────

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body   = dolphin_json_body();
    $action = $body['action'] ?? '';

    // ── Create a new thread ────────────────────────────────────────────────────
    if ($action === 'create') {
        $sourceType = trim($body['source_type'] ?? '');
        $sourceId   = trim($body['source_id']   ?? '');
        $fy         = trim($body['fy']           ?? '');
        $message    = trim($body['message']      ?? '');

        if (!$sourceType || !$sourceId || !$fy || !$message) {
            dolphin_send_json(['error' => 'source_type, source_id, fy, message required'], 400);
        }
        if (!in_array($sourceType, ['scope12', 'scope3'], true)) {
            dolphin_send_json(['error' => 'Invalid source_type'], 400);
        }

        $fromRole = $isDW ? 'deepwoods' : 'client';

        $pdo->beginTransaction();
        try {
            $pdo->prepare(
                'INSERT INTO ndc_threads (client_id, source_type, source_id, fy, last_from_role, created_by)
                 VALUES (?, ?, ?, ?, ?, ?)'
            )->execute([$clientId, $sourceType, $sourceId, $fy, $fromRole, $email]);
            $threadId = (int)$pdo->lastInsertId();

            $pdo->prepare(
                'INSERT INTO ndc_thread_messages (thread_id, from_role, author, message)
                 VALUES (?, ?, ?, ?)'
            )->execute([$threadId, $fromRole, $email, $message]);

            $pdo->commit();
            // Fire email notification (after commit, best-effort)
            ndc_send_notification($pdo, $clientId, $fromRole, $email, $sourceId, $fy, $message, 'create');
            dolphin_send_json(['ok' => true, 'thread_id' => $threadId]);
        } catch (PDOException $e) {
            $pdo->rollBack();
            error_log('ndc-threads create error: ' . $e->getMessage());
            dolphin_send_json(['error' => 'Failed to create thread'], 500);
        }
    }

    // ── Reply to an existing thread ────────────────────────────────────────────
    if ($action === 'reply') {
        $threadId = (int)($body['thread_id'] ?? 0);
        $message  = trim($body['message']    ?? '');

        if (!$threadId || !$message) {
            dolphin_send_json(['error' => 'thread_id and message required'], 400);
        }

        // Determine from_role: DW staff can reply as deepwoods
        $fromRole = $isDW ? 'deepwoods' : 'client';

        // Verify thread belongs to this client and fetch source info for the email
        $t = $pdo->prepare('SELECT id, source_id, fy FROM ndc_threads WHERE id = ? AND client_id = ?');
        $t->execute([$threadId, $clientId]);
        $threadRow = $t->fetch();
        if (!$threadRow) {
            dolphin_send_json(['error' => 'Thread not found'], 404);
        }

        $pdo->beginTransaction();
        try {
            $pdo->prepare(
                'INSERT INTO ndc_thread_messages (thread_id, from_role, author, message)
                 VALUES (?, ?, ?, ?)'
            )->execute([$threadId, $fromRole, $email, $message]);

            // Track who sent last (drives has_open / query_for_you status)
            $pdo->prepare(
                'UPDATE ndc_threads SET last_from_role = ?, updated_at = NOW() WHERE id = ?'
            )->execute([$fromRole, $threadId]);

            $pdo->commit();
            // Fire email notification (after commit, best-effort)
            ndc_send_notification($pdo, $clientId, $fromRole, $email, (string)$threadRow['source_id'], (string)$threadRow['fy'], $message, 'reply');
            dolphin_send_json(['ok' => true]);
        } catch (PDOException $e) {
            $pdo->rollBack();
            error_log('ndc-threads reply error: ' . $e->getMessage());
            dolphin_send_json(['error' => 'Failed to post reply'], 500);
        }
    }

    dolphin_send_json(['error' => 'Unknown action'], 400);
}
