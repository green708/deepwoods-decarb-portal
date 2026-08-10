<?php
declare(strict_types=1);
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/Smtp.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit(0); }

// ─────────────────────────────────────────────────────────────────────────────
// DATA HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Resolve the session token to email + client_id. Returns null if invalid. */
function get_user_from_token(PDO $pdo): ?array {
    $h = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!preg_match('/^Bearer\s+(.+)$/i', $h, $m)) return null;
    $stmt = $pdo->prepare(
        "SELECT u.email, u.client_id FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token = ? AND s.expires_at > NOW()"
    );
    $stmt->execute([$m[1]]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}

/** Return client name, portal URL, and display slug for email templates. */
function get_client_info(PDO $pdo, int $client_id): array {
    $stmt = $pdo->prepare('SELECT name, slug FROM clients WHERE id = ?');
    $stmt->execute([$client_id]);
    $client = $stmt->fetch(PDO::FETCH_ASSOC);

    // Look up portal_url from client_config; fall back to platform config
    $urlStmt = $pdo->prepare(
        "SELECT config_value FROM client_config WHERE client_id = ? AND config_key = 'portal_url'"
    );
    $urlStmt->execute([$client_id]);
    $portalUrl = $urlStmt->fetchColumn() ?: '';

    if (!$portalUrl) {
        $cfg = dolphin_config();
        $base = rtrim($cfg['platform_base_url'] ?? '', '/');
        $portalUrl = $base ?: 'https://ghgportal.deepwoodsgreen.com';
    }

    return [
        'name'       => $client['name']  ?? 'GHG Portal',
        'slug'       => $client['slug']  ?? '',
        'portal_url' => $portalUrl,
    ];
}

/** Fetch action/update items from the DB for this client. */
function get_priority_items(PDO $pdo, int $client_id): array {
    $stmt = $pdo->prepare(
        "SELECT item_type, entity, title, detail, priority, link, age, tag
         FROM priority_items WHERE client_id = ?
         ORDER BY FIELD(priority,'High','Medium','Low'), id"
    );
    $stmt->execute([$client_id]);
    $rows    = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $actions = [];
    $updates = [];
    foreach ($rows as $row) {
        if ($row['item_type'] === 'action') {
            $actions[] = $row;
        } else {
            $updates[] = $row;
        }
    }
    return ['actions' => $actions, 'updates' => $updates];
}

// ─────────────────────────────────────────────────────────────────────────────
// EMAIL BUILDER
// ─────────────────────────────────────────────────────────────────────────────
function build_email(
    string $to_name,
    bool $inc_actions,
    bool $inc_updates,
    array $actions,
    array $updates,
    string $portal_url,
    string $client_name
): string {
    $green  = '#1E6F5C';
    $navy   = '#0F2D40';
    $alert  = '#D90429';
    $amber  = '#D97706';
    $date   = date('d M Y');

    $priority_colors = ['High' => $alert, 'Medium' => $amber, 'Low' => '#6B7280'];
    $tag_colors      = ['Report' => $navy, 'Milestone' => $green, 'Target' => '#7C3AED'];

    $action_html = '';
    if ($inc_actions && !empty($actions)) {
        $action_html .= <<<HTML
<tr><td style="padding:24px 32px 8px;">
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
    <span style="display:inline-block;width:4px;height:20px;background:{$green};border-radius:2px;"></span>
    <span style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:{$green};">Action Needed</span>
  </div>
HTML;
        foreach ($actions as $item) {
            $pc = $priority_colors[$item['priority']] ?? '#6B7280';
            $title  = htmlspecialchars($item['title']  ?? '', ENT_QUOTES);
            $detail = htmlspecialchars($item['detail'] ?? '', ENT_QUOTES);
            $age    = htmlspecialchars($item['age']    ?? '', ENT_QUOTES);
            $prio   = htmlspecialchars($item['priority'] ?? '', ENT_QUOTES);
            $link   = htmlspecialchars($portal_url . ($item['link'] ?? ''), ENT_QUOTES);
            $action_html .= <<<HTML
  <div style="background:#fff;border:1px solid #E2E8F0;border-radius:10px;padding:16px 18px;margin-bottom:10px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
      <div style="flex:1;">
        <div style="font-size:14px;font-weight:600;color:{$navy};margin-bottom:4px;">{$title}</div>
        <div style="font-size:12px;color:#64748B;margin-bottom:6px;">{$age} &nbsp;·&nbsp; <b style="color:{$pc};">{$prio}</b></div>
        <div style="font-size:13px;color:#475569;">{$detail}</div>
      </div>
    </div>
    <div style="margin-top:12px;">
      <a href="{$link}" style="display:inline-block;background:{$navy};color:#fff;font-size:12px;font-weight:600;padding:6px 14px;border-radius:6px;text-decoration:none;">View in portal →</a>
    </div>
  </div>
HTML;
        }
        $action_html .= '</td></tr>';
    }

    $update_html = '';
    if ($inc_updates && !empty($updates)) {
        $update_html .= <<<HTML
<tr><td style="padding:8px 32px 8px;">
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
    <span style="display:inline-block;width:4px;height:20px;background:{$navy};border-radius:2px;"></span>
    <span style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:{$navy};">Updates</span>
  </div>
HTML;
        foreach ($updates as $item) {
            $tc = $tag_colors[$item['tag'] ?? ''] ?? '#6B7280';
            $title  = htmlspecialchars($item['title']  ?? '', ENT_QUOTES);
            $detail = htmlspecialchars($item['detail'] ?? '', ENT_QUOTES);
            $age    = htmlspecialchars($item['age']    ?? '', ENT_QUOTES);
            $tag    = htmlspecialchars($item['tag']    ?? '', ENT_QUOTES);
            $link   = htmlspecialchars($portal_url . ($item['link'] ?? ''), ENT_QUOTES);
            $update_html .= <<<HTML
  <div style="background:#fff;border:1px solid #E2E8F0;border-radius:10px;padding:16px 18px;margin-bottom:10px;">
    <div style="font-size:14px;font-weight:600;color:{$navy};margin-bottom:4px;">{$title}</div>
    <div style="font-size:12px;color:#64748B;margin-bottom:6px;">
      {$age} &nbsp;·&nbsp;
      <span style="background:color-mix(in oklab,{$tc} 12%,white);color:{$tc};font-size:10px;font-weight:700;padding:2px 8px;border-radius:100px;">{$tag}</span>
    </div>
    <div style="font-size:13px;color:#475569;">{$detail}</div>
    <div style="margin-top:10px;">
      <a href="{$link}" style="display:inline-block;background:#F1F5F9;color:{$navy};font-size:12px;font-weight:600;padding:5px 12px;border-radius:6px;text-decoration:none;border:1px solid #E2E8F0;">View →</a>
    </div>
  </div>
HTML;
        }
        $update_html .= '</td></tr>';
    }

    $high_count = count(array_filter($actions, fn($a) => ($a['priority'] ?? '') === 'High'));
    $badge = $high_count > 0
        ? "<span style='display:inline-block;background:{$alert};color:#fff;font-size:11px;font-weight:700;padding:2px 8px;border-radius:100px;margin-left:8px;'>{$high_count} urgent</span>"
        : '';

    $portal_url_safe = htmlspecialchars($portal_url, ENT_QUOTES);
    $client_name_safe = htmlspecialchars($client_name, ENT_QUOTES);

    return <<<HTML
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>{$client_name_safe} GHG Portal — Notification</title></head>
<body style="margin:0;padding:0;background:#F0F4F8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F0F4F8;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(15,45,64,.10);">

  <!-- Header -->
  <tr><td style="background:{$navy};padding:28px 32px;">
    <div style="display:flex;align-items:center;gap:12px;">
      <div style="width:36px;height:36px;background:{$green};border-radius:8px;display:flex;align-items:center;justify-content:center;">
        <span style="color:#fff;font-size:18px;font-weight:800;">D</span>
      </div>
      <div>
        <div style="color:#fff;font-size:16px;font-weight:700;letter-spacing:-.01em;">{$client_name_safe} GHG Portal</div>
        <div style="color:#94A3B8;font-size:12px;">Alert Centre Digest &mdash; {$date}</div>
      </div>
    </div>
  </td></tr>

  <!-- Intro -->
  <tr><td style="background:#F8FAFC;padding:20px 32px 4px;">
    <p style="font-size:14px;color:#475569;margin:0;">
      Hi <b style="color:{$navy};">{$to_name}</b>,<br><br>
      Here&rsquo;s your latest update from the {$client_name_safe} GHG engagement portal.
      {$badge}
    </p>
  </td></tr>

  {$action_html}
  {$update_html}

  <!-- CTA -->
  <tr><td style="background:#F8FAFC;padding:20px 32px 28px;text-align:center;">
    <a href="{$portal_url_safe}/priority-actions" style="display:inline-block;background:{$green};color:#fff;font-size:14px;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;letter-spacing:.01em;">
      Open Alert Centre
    </a>
    <p style="margin:16px 0 0;font-size:11px;color:#94A3B8;">
      You&rsquo;re receiving this because notifications are enabled for your account.<br>
      <a href="{$portal_url_safe}/priority-actions" style="color:#64748B;">Manage preferences</a>
    </p>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:{$navy};padding:16px 32px;">
    <p style="margin:0;font-size:11px;color:#64748B;text-align:center;">
      {$client_name_safe} GHG Portal &mdash; Powered by <b style="color:#94A3B8;">Deepwoods Green</b>
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>
HTML;
}

// ─────────────────────────────────────────────────────────────────────────────
// SEND to one user
// ─────────────────────────────────────────────────────────────────────────────
function send_to_user(
    string $recipient_email,
    array $prefs,
    array $actions,
    array $updates,
    string $portal_url,
    string $client_name,
    PDO $pdo
): bool {
    $cfg = dolphin_config()['smtp'];

    $inc_a = (bool)$prefs['include_actions'];
    $inc_u = (bool)$prefs['include_updates'];

    $to_name = strstr($recipient_email, '@', true) ?: $recipient_email;
    $html    = build_email($to_name, $inc_a, $inc_u, $actions, $updates, $portal_url, $client_name);

    $high = count(array_filter($actions, fn($a) => ($a['priority'] ?? '') === 'High'));
    $subject = $high > 0
        ? "⚠ {$high} urgent action(s) — {$client_name} GHG Portal"
        : "{$client_name} GHG Portal — Notification Digest";

    try {
        $smtp = new Smtp($cfg['host'], $cfg['port'], $cfg['username'], $cfg['app_password'], $cfg['from_email'], $cfg['from_name']);
        $smtp->send($recipient_email, $subject, $html);

        $pdo->prepare("UPDATE notification_prefs SET last_sent_at = NOW() WHERE user_email = ?")->execute([$recipient_email]);
        $pdo->prepare("INSERT INTO notification_log (user_email, frequency, status, details) VALUES (?,?,?,?)")
            ->execute([$recipient_email, $prefs['frequency'], 'sent', "Actions: ".count($actions).", Updates: ".count($updates)]);
        return true;
    } catch (Exception $e) {
        $pdo->prepare("INSERT INTO notification_log (user_email, frequency, status, details) VALUES (?,?,?,?)")
            ->execute([$recipient_email, $prefs['frequency'] ?? 'manual', 'failed', $e->getMessage()]);
        return false;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE: GET?cron_secret=xxx  — run by scheduled cron job
// ─────────────────────────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $cfg    = dolphin_config();
    $secret = $cfg['cron_secret'] ?? 'ghg-cron-2026';
    if (($_GET['cron_secret'] ?? '') !== $secret) {
        http_response_code(403); die(json_encode(['error' => 'Forbidden']));
    }

    $pdo   = dolphin_db();
    $today = date('Y-m-d');
    $dow   = (int)date('N'); // 1=Mon … 7=Sun

    // Fetch all enabled users whose next send is due, joined with their client_id
    $stmt = $pdo->query(
        "SELECT np.*, u.client_id FROM notification_prefs np
         JOIN users u ON u.email = np.user_email
         WHERE np.enabled = 1"
    );
    $due  = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $last = $row['last_sent_at'] ? new DateTime($row['last_sent_at']) : null;
        $now  = new DateTime();
        $send = false;

        switch ($row['frequency']) {
            case 'daily':
                $send = !$last || $last->format('Y-m-d') < $today;
                break;
            case 'weekly':
                $send = !$last || (($now->getTimestamp() - $last->getTimestamp()) >= 7 * 86400);
                break;
            case 'monthly':
                $send = !$last || (($now->getTimestamp() - $last->getTimestamp()) >= 30 * 86400);
                break;
            case 'custom':
                $send = $row['custom_date'] === $today
                    && (!$last || $last->format('Y-m-d') < $today);
                break;
        }
        if ($send) $due[] = $row;
    }

    $sent = 0; $failed = 0;
    foreach ($due as $prefs) {
        $client_id   = (int)($prefs['client_id'] ?? 0);
        $client_info = $client_id ? get_client_info($pdo, $client_id) : ['name' => 'GHG Portal', 'portal_url' => ''];
        $items       = $client_id ? get_priority_items($pdo, $client_id) : ['actions' => [], 'updates' => []];
        $ok = send_to_user(
            $prefs['user_email'], $prefs,
            $items['actions'], $items['updates'],
            $client_info['portal_url'], $client_info['name'],
            $pdo
        );
        $ok ? $sent++ : $failed++;
    }

    echo json_encode(['ok' => true, 'due' => count($due), 'sent' => $sent, 'failed' => $failed]);
    exit;
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE: POST — send immediately to the authenticated user (test / manual)
// ─────────────────────────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $pdo      = dolphin_db();
    $authUser = get_user_from_token($pdo);
    if (!$authUser) { http_response_code(401); die(json_encode(['error' => 'Unauthenticated'])); }

    $email     = $authUser['email'];
    $client_id = (int)($authUser['client_id'] ?? 0);

    // Fetch prefs (or defaults)
    $stmt = $pdo->prepare("SELECT * FROM notification_prefs WHERE user_email = ?");
    $stmt->execute([$email]);
    $prefs = $stmt->fetch(PDO::FETCH_ASSOC) ?: [
        'frequency' => 'manual', 'include_actions' => 1, 'include_updates' => 1,
    ];

    $client_info = $client_id ? get_client_info($pdo, $client_id) : ['name' => 'GHG Portal', 'portal_url' => ''];
    $items       = $client_id ? get_priority_items($pdo, $client_id) : ['actions' => [], 'updates' => []];

    // Also BCC test address if configured
    $test_email = dolphin_config()['notification_test_email'] ?? null;
    $recipients = [$email];
    if ($test_email && $test_email !== $email) $recipients[] = $test_email;

    $results = [];
    foreach ($recipients as $to) {
        $ok = send_to_user(
            $to, $prefs,
            $items['actions'], $items['updates'],
            $client_info['portal_url'], $client_info['name'],
            $pdo
        );
        $results[$to] = $ok ? 'sent' : 'failed';
    }

    $all_ok = !in_array('failed', $results, true);
    echo json_encode([
        'ok'         => $all_ok,
        'message'    => $all_ok ? 'Email sent successfully' : 'Some sends failed — check notification_log',
        'recipients' => $results,
    ]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
