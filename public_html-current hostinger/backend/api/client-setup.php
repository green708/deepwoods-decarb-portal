<?php
// client-setup.php — POST /backend/api/client-setup.php
// Saves the client onboarding wizard data: org profile, reporting config,
// entity additions, and emissions scope boundary.
// Called once when the client completes the /onboard wizard.

declare(strict_types=1);
require_once __DIR__ . '/db.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Allow-Methods: POST, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    dolphin_send_json(['error' => 'POST only'], 405);
}

$user = dolphin_require_auth();
dolphin_require_active_client($user);
$clientId = (int)$user['client_id'];

if (!$clientId) {
    dolphin_send_json(['error' => 'User is not associated with a client'], 403);
}

// Only the primary client role (sustainability_team / ESG Manager) may
// configure the workspace. Uploaders and leadership must not overwrite setup.
if ($user['role'] !== 'sustainability_team') {
    dolphin_send_json(['error' => 'Only ESG Managers (sustainability_team) may configure the workspace'], 403);
}

$body = dolphin_json_body();

$pdo = dolphin_db();

try {
    $pdo->beginTransaction();

    // ── 1. Update the clients row ──────────────────────────────────────────────

    $companyName = trim($body['company_name'] ?? '');
    $currency    = in_array($body['currency'] ?? '', ['INR', 'USD'], true) ? $body['currency'] : 'INR';

    if ($companyName !== '') {
        $pdo->prepare('UPDATE clients SET name = ?, currency = ? WHERE id = ?')
            ->execute([$companyName, $currency, $clientId]);
    }

    // ── 2. Persist config keys ────────────────────────────────────────────────

    $configKeys = [
        'industry'                => $body['industry']              ?? null,
        'country'                 => $body['country']               ?? null,
        'consolidation_approach'  => $body['consolidation_approach'] ?? null,
        'fiscal_year_start_month' => isset($body['fy_start_month'])
                                     ? (string)(int)$body['fy_start_month'] : null,
        's1_stationary'           => isset($body['s1_stationary'])
                                     ? ($body['s1_stationary'] ? '1' : '0') : null,
        's1_mobile'               => isset($body['s1_mobile'])
                                     ? ($body['s1_mobile'] ? '1' : '0') : null,
        's1_fugitive'             => isset($body['s1_fugitive'])
                                     ? ($body['s1_fugitive'] ? '1' : '0') : null,
        's2_grid'                 => isset($body['s2_grid'])
                                     ? ($body['s2_grid'] ? '1' : '0') : null,
        's2_renewable'            => isset($body['s2_renewable'])
                                     ? ($body['s2_renewable'] ? '1' : '0') : null,
        's3_included'             => isset($body['s3_included'])
                                     ? ($body['s3_included'] ? '1' : '0') : null,
        's3_boundary'             => isset($body['s3_categories']) && is_array($body['s3_categories'])
                                     ? json_encode(array_map(fn($n) => "Cat $n", $body['s3_categories']))
                                     : null,
        'base_year'               => isset($body['base_year']) && $body['base_year'] !== ''
                                     ? trim((string)$body['base_year']) : null,
        'entity_scope_json'       => isset($body['entity_scope']) && is_array($body['entity_scope'])
                                     ? json_encode($body['entity_scope']) : null,
        'setup_complete'          => 'true',
    ];

    $upsertConfig = $pdo->prepare(
        'INSERT INTO client_config (client_id, config_key, config_value)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)'
    );

    foreach ($configKeys as $key => $value) {
        if ($value !== null) {
            $upsertConfig->execute([$clientId, $key, $value]);
        }
    }

    // ── 3. Add new entities (not from DB) ─────────────────────────────────────

    $newEntities = $body['entities'] ?? [];
    if (is_array($newEntities) && count($newEntities) > 0) {
        $stmt = $pdo->prepare('SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM client_entities WHERE client_id = ?');
        $stmt->execute([$clientId]);
        $maxOrder = (int)($stmt->fetchColumn() ?? 0);

        $insertEntity = $pdo->prepare(
            'INSERT IGNORE INTO client_entities (client_id, code, name, short_name, is_consolidated, sort_order)
             VALUES (?, ?, ?, ?, ?, ?)'
        );

        foreach ($newEntities as $i => $ent) {
            $code  = strtoupper(trim($ent['code']  ?? ''));
            $name  = trim($ent['name']       ?? '');
            $short = trim($ent['short_name'] ?? $code);
            $isConsolidated = !empty($ent['is_consolidated']) ? 1 : 0;

            if ($code === '' || $name === '') continue;

            $insertEntity->execute([
                $clientId, $code, $name, $short, $isConsolidated, $maxOrder + $i + 1
            ]);
        }
    }

    $pdo->commit();
    dolphin_send_json(['ok' => true, 'setup_complete' => true]);

} catch (PDOException $e) {
    $pdo->rollBack();
    error_log('client-setup.php error: ' . $e->getMessage());
    dolphin_send_json(['error' => 'Failed to save setup. Please try again.'], 500);
}
