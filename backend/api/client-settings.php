<?php
// client-settings.php — POST /backend/api/client-settings.php
// Saves company profile edits: org details, compliance fields, and platform settings.
// Updates: clients table, client_config, and client_entities (parent entity).

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

if ($user['role'] !== 'sustainability_team') {
    dolphin_send_json(['error' => 'Only ESG Managers (sustainability_team) may update company settings'], 403);
}
// Org-wide company profile — entity admins manage their own entity's facilities and team
// elsewhere, not client-level settings (legal name, GSTIN, address, industry).
if (!empty($user['entity_scope'])) {
    dolphin_send_json(['error' => 'Entity admins cannot update client-level company settings. Contact your org admin.'], 403);
}

$body = dolphin_json_body();
$pdo  = dolphin_db();

try {
    $pdo->beginTransaction();

    // ── 1. Update clients table ────────────────────────────────────────────────

    $clientSets   = [];
    $clientParams = [];

    $name = trim($body['name'] ?? '');
    if ($name !== '') {
        $clientSets[]   = 'name = ?';
        $clientParams[] = $name;
    }

    $currency = $body['currency'] ?? '';
    if (in_array($currency, ['INR', 'USD', 'EUR', 'GBP', 'SGD', 'AED'], true)) {
        $clientSets[]   = 'currency = ?';
        $clientParams[] = $currency;
    }

    $reportingPeriod = $body['reporting_period'] ?? '';
    if (in_array($reportingPeriod, ['FY', 'CY'], true)) {
        $clientSets[]   = 'reporting_period = ?';
        $clientParams[] = $reportingPeriod;
    }

    $primaryColor = trim($body['primary_color'] ?? '');
    if ($primaryColor !== '' && preg_match('/^#[0-9A-Fa-f]{3,8}$/', $primaryColor)) {
        $clientSets[]   = 'primary_color = ?';
        $clientParams[] = $primaryColor;
    }

    if (!empty($clientSets)) {
        $clientParams[] = $clientId;
        $pdo->prepare('UPDATE clients SET ' . implode(', ', $clientSets) . ' WHERE id = ?')
            ->execute($clientParams);
    }

    // ── 2. Upsert client_config keys ──────────────────────────────────────────

    $upsert = $pdo->prepare(
        'INSERT INTO client_config (client_id, config_key, config_value)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)'
    );

    $configKeys = [
        'industry'        => trim($body['industry']         ?? ''),
        'operating_name'  => trim($body['operating_name']   ?? ''),
        'country'         => isset($body['is_india']) ? ($body['is_india'] ? 'India' : 'Other') : null,
        'reporting_model' => trim($body['reporting_model']  ?? ''),
        'is_msme'         => isset($body['is_msme'])        ? ($body['is_msme'] ? '1' : '0') : null,
        'udyam_number'    => trim($body['udyam_number']     ?? ''),
        'website'         => trim($body['website']          ?? ''),
    ];

    foreach ($configKeys as $key => $value) {
        if ($value !== null) {
            $upsert->execute([$clientId, $key, $value]);
        }
    }

    // ── 3. Update parent entity (org_type, tax_id / gstin, legal_address) ────

    $orgType     = trim($body['org_type']      ?? '');
    $gstin       = strtoupper(trim($body['gstin'] ?? ''));
    $legalAddress = trim($body['legal_address'] ?? '');

    if ($orgType !== '' || $gstin !== '' || $legalAddress !== '') {
        // Find the parent (non-consolidated) entity for this client
        $stmt = $pdo->prepare(
            'SELECT id FROM client_entities WHERE client_id = ? AND is_consolidated = 0 ORDER BY sort_order ASC LIMIT 1'
        );
        $stmt->execute([$clientId]);
        $entityId = $stmt->fetchColumn();

        if ($entityId) {
            $entSets   = [];
            $entParams = [];

            if ($orgType !== '') {
                $entSets[]   = 'org_type = ?';
                $entParams[] = $orgType;
            }
            if ($gstin !== '') {
                $entSets[]   = 'tax_id = ?';
                $entParams[] = $gstin;
            }
            if ($legalAddress !== '') {
                $entSets[]   = 'legal_address = ?';
                $entParams[] = $legalAddress;
            }

            if (!empty($entSets)) {
                $entParams[] = $entityId;
                try {
                    $pdo->prepare('UPDATE client_entities SET ' . implode(', ', $entSets) . ' WHERE id = ?')
                        ->execute($entParams);
                } catch (PDOException $e) {
                    // Columns may not exist yet (migration 002) — skip silently
                }
            }
        }
    }

    $pdo->commit();
    dolphin_send_json(['ok' => true]);

} catch (PDOException $e) {
    $pdo->rollBack();
    error_log('client-settings.php error: ' . $e->getMessage());
    dolphin_send_json(['error' => 'Failed to save settings. Please try again.'], 500);
}
