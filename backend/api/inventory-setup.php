<?php
// inventory-setup.php — POST /backend/api/inventory-setup.php
// Client-facing Phase B: saves emissions inventory boundary configuration.
// Called when the primary contact completes the /inventory-setup wizard.
// Payment must already be confirmed (dolphin_require_payment).
// Sets inventory_complete=true in client_config.

declare(strict_types=1);
require_once __DIR__ . '/db.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Allow-Methods: POST, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { dolphin_send_json(['error' => 'POST only'], 405); }

$user = dolphin_require_auth();
dolphin_require_active_client($user);
dolphin_require_payment($user);

if ($user['role'] !== 'sustainability_team') {
    dolphin_send_json(['error' => 'Only ESG Managers may configure the inventory boundary'], 403);
}
// The emissions boundary is a client-wide setting, not per-entity — entity admins
// shouldn't be able to reconfigure Scope 1/2/3 boundary for the whole client.
if (!empty($user['entity_scope'])) {
    dolphin_send_json(['error' => 'Entity admins cannot configure the client-wide inventory boundary. Contact your org admin.'], 403);
}

$clientId = (int)($user['client_id'] ?? 0);
if (!$clientId) { dolphin_send_json(['error' => 'User is not associated with a client'], 403); }

$body = dolphin_json_body();
$pdo  = dolphin_db();

try {
    $pdo->beginTransaction();

    $configKeys = [
        's1_stationary'      => isset($body['s1_stationary'])
                                ? ($body['s1_stationary'] ? '1' : '0') : null,
        's1_mobile'          => isset($body['s1_mobile'])
                                ? ($body['s1_mobile']     ? '1' : '0') : null,
        's1_fugitive'        => isset($body['s1_fugitive'])
                                ? ($body['s1_fugitive']   ? '1' : '0') : null,
        's2_grid'            => isset($body['s2_grid'])
                                ? ($body['s2_grid']       ? '1' : '0') : null,
        's2_renewable'       => isset($body['s2_renewable'])
                                ? ($body['s2_renewable']  ? '1' : '0') : null,
        's3_included'        => isset($body['s3_included'])
                                ? ($body['s3_included']   ? '1' : '0') : null,
        's3_boundary'        => (isset($body['s3_categories']) && is_array($body['s3_categories'])
                                 && count($body['s3_categories']) > 0)
                                ? json_encode(array_map(fn($n) => "Cat $n", $body['s3_categories']))
                                : null,
        'base_year'          => (isset($body['base_year']) && (string)$body['base_year'] !== '')
                                ? trim((string)$body['base_year']) : null,
        'inventory_complete' => 'true',
    ];

    $upsert = $pdo->prepare(
        'INSERT INTO client_config (client_id, config_key, config_value)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)'
    );

    foreach ($configKeys as $key => $value) {
        if ($value !== null) {
            $upsert->execute([$clientId, $key, $value]);
        }
    }

    $pdo->commit();
    dolphin_send_json(['ok' => true, 'inventory_complete' => true]);

} catch (PDOException $e) {
    $pdo->rollBack();
    error_log('inventory-setup.php error: ' . $e->getMessage());
    dolphin_send_json(['error' => 'Failed to save. Please try again.'], 500);
}
