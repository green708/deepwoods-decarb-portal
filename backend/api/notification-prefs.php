<?php
declare(strict_types=1);
require_once __DIR__ . '/db.php';

// ── CORS / JSON headers ───────────────────────────────────────────────────────
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit(0); }

$authUser = dolphin_require_auth();
dolphin_require_active_client($authUser);
$email    = $authUser['email'];
$pdo      = dolphin_db();

// ── GET: return current prefs (create row if first visit) ─────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $pdo->prepare("SELECT * FROM notification_prefs WHERE user_email = ?");
    $stmt->execute([$email]);
    $prefs = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$prefs) {
        // Insert defaults
        $pdo->prepare("INSERT INTO notification_prefs (user_email) VALUES (?)")->execute([$email]);
        $stmt->execute([$email]);
        $prefs = $stmt->fetch(PDO::FETCH_ASSOC);
    }

    // Cast booleans
    $prefs['enabled']         = (bool)$prefs['enabled'];
    $prefs['include_actions'] = (bool)$prefs['include_actions'];
    $prefs['include_updates'] = (bool)$prefs['include_updates'];

    echo json_encode(['ok' => true, 'prefs' => $prefs]);
    exit;
}

// ── POST: save prefs ──────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true) ?? [];

    $allowed_freq = ['daily', 'weekly', 'monthly', 'custom'];
    $freq         = in_array($body['frequency'] ?? '', $allowed_freq, true) ? $body['frequency'] : 'weekly';
    $enabled      = isset($body['enabled'])         ? (int)(bool)$body['enabled']         : 1;
    $inc_actions  = isset($body['include_actions']) ? (int)(bool)$body['include_actions'] : 1;
    $inc_updates  = isset($body['include_updates']) ? (int)(bool)$body['include_updates'] : 1;
    $custom_date  = ($freq === 'custom' && !empty($body['custom_date'])) ? $body['custom_date'] : null;
    $send_time    = !empty($body['send_time']) ? $body['send_time'] : '08:00:00';

    // Validate custom_date
    if ($custom_date && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $custom_date)) {
        $custom_date = null;
    }
    // Validate send_time
    if (!preg_match('/^\d{2}:\d{2}(:\d{2})?$/', $send_time)) {
        $send_time = '08:00:00';
    }

    $stmt = $pdo->prepare("
        INSERT INTO notification_prefs (user_email, enabled, frequency, custom_date, send_time, include_actions, include_updates)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            enabled         = VALUES(enabled),
            frequency       = VALUES(frequency),
            custom_date     = VALUES(custom_date),
            send_time       = VALUES(send_time),
            include_actions = VALUES(include_actions),
            include_updates = VALUES(include_updates),
            updated_at      = NOW()
    ");
    $stmt->execute([$email, $enabled, $freq, $custom_date, $send_time, $inc_actions, $inc_updates]);

    echo json_encode(['ok' => true, 'message' => 'Preferences saved']);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
