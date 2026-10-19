<?php
// admin/client-settings.php — GET / POST. Deepwoods staff edit a client's targets, consultant and account owner.

declare(strict_types=1);
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../lib_admin.php';
require_once __DIR__ . '/../lib_portal.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Headers: Content-Type, X-Api-Key, Authorization');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');

const SETTING_DEFAULTS = [
    'base_year_s12'    => 'FY22',
    'sbti_target_s12'  => '42',
    'sbti_target_year' => '2030',
    'netzero_year'     => '2040',
];

$user   = dolphin_require_auth();
dolphin_require_deepwoods($user);
$method = dolphin_require_method(['GET', 'POST']);
$pdo    = dolphin_db();
$body   = $method === 'POST' ? dolphin_json_body() : null;
$clientId = dolphin_staff_client_id($body);
$client   = dolphin_client_or_404($pdo, $clientId);

function settings_payload(PDO $pdo, array $client): array {
    $config = dolphin_client_config($pdo, (int)$client['id']);
    $settings = [];
    foreach (array_keys(CLIENT_SETTING_KEYS) as $k) {
        $settings[$k] = isset($config[$k]) && trim((string)$config[$k]) !== '' ? (string)$config[$k] : null;
    }
    return [
        'client' => [
            'id' => (int)$client['id'],
            'name' => $client['name'],
            'slug' => $client['slug'],
            'is_active' => (bool)$client['is_active'],
            'payment_status' => $client['payment_status'],
            'reporting_period' => $client['reporting_period'],
            'account_owner' => ($client['account_owner'] ?? '') !== '' ? $client['account_owner'] : null,
            'logo_url' => $client['logo_url'],
            'primary_color' => $client['primary_color'],
        ],
        'settings' => $settings,
        'defaults' => SETTING_DEFAULTS,
        'fy' => dolphin_client_fy($client, $config),
    ];
}

if ($method === 'GET') {
    dolphin_send_json(settings_payload($pdo, $client));
}

// ── POST ────────────────────────────────────────────────────────────────────
$incoming = $body['settings'] ?? [];
if (!is_array($incoming)) dolphin_send_json(['error' => 'settings must be an object'], 400);

$errors = [];
$clean  = [];   // key => normalised string|null
foreach ($incoming as $key => $raw) {
    $key = (string)$key;
    if (!isset(CLIENT_SETTING_KEYS[$key])) { $errors[$key] = 'unknown setting'; continue; }
    if (is_array($raw) || is_object($raw) || is_bool($raw)) { $errors[$key] = 'must be a string, number or null'; continue; }
    try {
        $clean[$key] = dolphin_validate_setting(CLIENT_SETTING_KEYS[$key], $raw);
    } catch (InvalidArgumentException $e) {
        $errors[$key] = $e->getMessage();
    }
}

$ownerProvided = array_key_exists('account_owner', $body ?? []);
$newOwner = null;
if ($ownerProvided) {
    $rawOwner = $body['account_owner'];
    if ($rawOwner !== null && !is_string($rawOwner)) {
        $errors['account_owner'] = 'must be an email address or null';
    } else {
        $newOwner = $rawOwner === null ? null : strtolower(trim($rawOwner));
        if ($newOwner === '') $newOwner = null;
        if ($newOwner !== null) {
            $st = $pdo->prepare("SELECT 1 FROM users WHERE email = ? AND role IN ('deepwoods_admin','deepwoods_coordinator')");
            $st->execute([$newOwner]);
            if (!$st->fetchColumn()) $errors['account_owner'] = 'must be the email of a Deepwoods staff user';
        }
    }
}
if ($errors) dolphin_validation_failed($errors);

$currentOwner = ($client['account_owner'] ?? '') !== '' ? strtolower((string)$client['account_owner']) : null;
$ownerChanges = $ownerProvided && $newOwner !== $currentOwner;
if ($ownerChanges && $user['role'] !== 'deepwoods_admin') {
    dolphin_send_json(['error' => 'Only a deepwoods_admin can change the account owner'], 403);
}

$current = dolphin_client_config($pdo, $clientId);
$changed = [];
$pdo->beginTransaction();
try {
    foreach ($clean as $key => $val) {
        $old = isset($current[$key]) && trim((string)$current[$key]) !== '' ? (string)$current[$key] : null;
        if ($val === $old) continue;
        if ($val === null) {
            $pdo->prepare('DELETE FROM client_config WHERE client_id = ? AND config_key = ?')->execute([$clientId, $key]);
        } else {
            $pdo->prepare(
                'INSERT INTO client_config (client_id, config_key, config_value) VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)'
            )->execute([$clientId, $key, $val]);
        }
        $changed[] = $key;
    }
    if ($ownerChanges) {
        $pdo->prepare('UPDATE clients SET account_owner = ? WHERE id = ?')->execute([$newOwner, $clientId]);
        $changed[] = 'account_owner';
    }
    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    error_log('client-settings save failed: ' . $e->getMessage());
    dolphin_send_json(['error' => 'Failed to save settings'], 500);
}

if ($changed) {
    dolphin_log_activity($pdo, $clientId, (string)$user['email'], 'settings_updated', implode(', ', $changed));
}
dolphin_send_json(settings_payload($pdo, dolphin_client_or_404($pdo, $clientId)));
