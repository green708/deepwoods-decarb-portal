<?php
// tracker-reminder.php — POST /backend/api/tracker-reminder.php
// Sends a data-collection reminder email to all client_uploader users
// for the given client. Caller must be deepwoods_admin or deepwoods_coordinator.

declare(strict_types=1);
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/Smtp.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Allow-Methods: POST, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit;
}

$authUser = dolphin_require_auth();
if (!in_array($authUser['role'], ['deepwoods_admin', 'deepwoods_coordinator'], true)) {
    http_response_code(403); echo json_encode(['error' => 'Deepwoods staff only']); exit;
}

$body      = json_decode(file_get_contents('php://input'), true) ?? [];
$entity    = trim((string)($body['entity'] ?? ''));
$fy        = trim((string)($body['fy'] ?? ''));
$client_id = (int)($body['client_id'] ?? 0);

if (!$client_id) {
    http_response_code(400); echo json_encode(['error' => 'client_id required']); exit;
}

$pdo = dolphin_db();

// Get client info
$stmt = $pdo->prepare("SELECT name FROM clients WHERE id = ?");
$stmt->execute([$client_id]);
$client = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$client) {
    http_response_code(404); echo json_encode(['error' => 'Client not found']); exit;
}
$clientName = $client['name'];

// Get portal URL
$urlStmt = $pdo->prepare(
    "SELECT config_value FROM client_config WHERE client_id = ? AND config_key = 'portal_url'"
);
$urlStmt->execute([$client_id]);
$portalUrl = $urlStmt->fetchColumn() ?: '';
if (!$portalUrl) {
    $cfg       = dolphin_config();
    $portalUrl = rtrim($cfg['platform_base_url'] ?? '', '/') ?: 'https://ghgportal.deepwoodsgreen.com';
}

// Find all client_uploader users for this client (optionally scoped to entity)
$sql = "SELECT email FROM users WHERE client_id = ? AND role = 'client_uploader'";
$params = [$client_id];
if ($entity) {
    $sql    .= " AND (entity_scope IS NULL OR entity_scope = ?)";
    $params[] = $entity;
}
$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$uploaders = $stmt->fetchAll(PDO::FETCH_COLUMN);

if (empty($uploaders)) {
    echo json_encode(['ok' => true, 'sent' => 0, 'message' => 'No client_uploader users found for this client']);
    exit;
}

// Build reminder email
function build_reminder_email(string $toName, string $clientName, string $portalUrl, string $fy): string {
    $green = '#1E6F5C';
    $navy  = '#0F2D40';
    $date  = date('d M Y');
    $toNameSafe   = htmlspecialchars($toName,   ENT_QUOTES);
    $clientSafe   = htmlspecialchars($clientName, ENT_QUOTES);
    $portalSafe   = htmlspecialchars($portalUrl,  ENT_QUOTES);
    $fySafe       = htmlspecialchars($fy, ENT_QUOTES);
    $submitUrl    = htmlspecialchars($portalUrl . '/submissions', ENT_QUOTES);

    return <<<HTML
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>GHG Data Collection Reminder — {$clientSafe}</title></head>
<body style="margin:0;padding:0;background:#F0F4F8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F0F4F8;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(15,45,64,.10);">

  <tr><td style="background:{$navy};padding:28px 32px;">
    <div style="display:flex;align-items:center;gap:12px;">
      <div style="width:36px;height:36px;background:{$green};border-radius:8px;display:flex;align-items:center;justify-content:center;">
        <span style="color:#fff;font-size:18px;font-weight:800;">D</span>
      </div>
      <div>
        <div style="color:#fff;font-size:16px;font-weight:700;">{$clientSafe} Decarbonisation Portal</div>
        <div style="color:#94A3B8;font-size:12px;">Data Collection Reminder &mdash; {$date}</div>
      </div>
    </div>
  </td></tr>

  <tr><td style="background:#F8FAFC;padding:28px 32px;">
    <p style="font-size:15px;font-weight:700;color:{$navy};margin:0 0 12px;">Hi {$toNameSafe},</p>
    <p style="font-size:14px;color:#475569;margin:0 0 16px;">
      This is a reminder to submit your GHG activity data for <strong>{$fySafe}</strong> on the {$clientSafe} Decarbonisation Portal.
    </p>
    <p style="font-size:14px;color:#475569;margin:0 0 24px;">
      Please log in and fill in the monthly consumption figures for all equipment at your facility. Data can be entered month-by-month — you don't need to complete everything in one session.
    </p>
    <div style="text-align:center;">
      <a href="{$submitUrl}" style="display:inline-block;background:{$green};color:#fff;font-size:14px;font-weight:700;padding:13px 32px;border-radius:8px;text-decoration:none;letter-spacing:.01em;">
        Open Data Submission →
      </a>
    </div>
  </td></tr>

  <tr><td style="background:{$navy};padding:16px 32px;">
    <p style="margin:0;font-size:11px;color:#64748B;text-align:center;">
      {$clientSafe} Decarbonisation Portal &mdash; Powered by <b style="color:#94A3B8;">Deepwoods Green</b>
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>
HTML;
}

$cfg     = dolphin_config()['smtp'];
$sent    = 0;
$failed  = 0;
$results = [];

foreach ($uploaders as $email) {
    $toName  = strstr($email, '@', true) ?: $email;
    $html    = build_reminder_email($toName, $clientName, $portalUrl, $fy);
    $subject = "Action required: GHG data submission for {$clientName} — {$fy}";

    try {
        $smtp = new Smtp(
            $cfg['host'], $cfg['port'],
            $cfg['username'], $cfg['app_password'],
            $cfg['from_email'], $cfg['from_name']
        );
        $smtp->send($email, $subject, $html);

        $pdo->prepare(
            "INSERT INTO notification_log (user_email, frequency, status, details) VALUES (?,?,?,?)"
        )->execute([$email, 'manual', 'sent', "Tracker reminder: {$entity} {$fy}"]);

        $results[$email] = 'sent';
        $sent++;
    } catch (Exception $e) {
        $pdo->prepare(
            "INSERT INTO notification_log (user_email, frequency, status, details) VALUES (?,?,?,?)"
        )->execute([$email, 'manual', 'failed', $e->getMessage()]);
        $results[$email] = 'failed';
        $failed++;
    }
}

echo json_encode([
    'ok'         => $failed === 0,
    'sent'       => $sent,
    'failed'     => $failed,
    'recipients' => $results,
]);
