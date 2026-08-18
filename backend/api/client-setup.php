<?php
// client-setup.php — POST /backend/api/client-setup.php
// Saves the client onboarding wizard data: org profile, reporting config,
// entity additions, and emissions scope boundary.
// Called once when the client completes the /onboard wizard.

declare(strict_types=1);
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/Smtp.php';

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

    $companyName  = trim($body['company_name'] ?? '');
    $currency     = in_array($body['currency'] ?? '', ['INR', 'USD'], true) ? $body['currency'] : 'INR';
    $logoUrl      = isset($body['logo_url'])      ? (string)$body['logo_url']      : null;
    $primaryColor = isset($body['primary_color']) ? trim((string)$body['primary_color']) : null;

    $clientSets   = ['currency = ?'];
    $clientParams = [$currency];

    if ($companyName !== '') {
        $clientSets[]   = 'name = ?';
        $clientParams[] = $companyName;
    }
    if ($logoUrl !== null && $logoUrl !== '') {
        $clientSets[]   = 'logo_url = ?';
        $clientParams[] = $logoUrl;
    }
    if ($primaryColor !== null && $primaryColor !== '' && preg_match('/^#[0-9A-Fa-f]{3,8}$/', $primaryColor)) {
        $clientSets[]   = 'primary_color = ?';
        $clientParams[] = $primaryColor;
    }

    $clientParams[] = $clientId;
    $pdo->prepare('UPDATE clients SET ' . implode(', ', $clientSets) . ' WHERE id = ?')
        ->execute($clientParams);

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
        'facility_count'          => isset($body['facility_count'])
                                     ? (string)(int)$body['facility_count'] : null,
        'setup_complete'          => 'true',
        'primary_contact_email'   => $user['email'],  // used to gate /register to primary contact only
    ];

    // reporting_model (consolidated / separate / mixed)
    $reporting_model_input = $body['reporting_model'] ?? null;
    if ($reporting_model_input !== null && in_array($reporting_model_input, ['consolidated', 'separate', 'mixed'], true)) {
        $configKeys['reporting_model'] = $reporting_model_input;
    }

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
            'INSERT INTO client_entities (client_id, code, name, short_name, is_consolidated, sort_order)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                 name            = VALUES(name),
                 short_name      = VALUES(short_name),
                 is_consolidated = VALUES(is_consolidated)'
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

    // ── 4. Update legal entity detail columns (nullable additions from migration 002) ──
    $legal_entities = $body['legal_entities'] ?? [];
    if (is_array($legal_entities) && count($legal_entities) > 0) {
        try {
            $updateLegal = $pdo->prepare(
                'UPDATE client_entities
                 SET country = ?, registration_no = ?, tax_id = ?, org_type = ?, legal_address = ?
                 WHERE client_id = ? AND code = ?'
            );
            foreach ($legal_entities as $le) {
                $code = strtoupper(trim($le['code'] ?? ''));
                if ($code === '') continue;
                $updateLegal->execute([
                    $le['country']         ?? null,
                    $le['registration_no'] ?? null,
                    $le['tax_id']          ?? null,
                    $le['org_type']        ?? null,
                    $le['legal_address']   ?? null,
                    $clientId,
                    $code,
                ]);
            }
        } catch (PDOException $e) {
            // Migration 002 not yet applied — skip silently
        }
    }

    // ── 5. Replace reporting_engagements ──────────────────────────────────────
    $engagements = $body['reporting_engagements'] ?? [];
    if (is_array($engagements) && count($engagements) > 0) {
        try {
            $pdo->prepare('DELETE FROM reporting_engagements WHERE client_id = ?')
                ->execute([$clientId]);

            $insertRE = $pdo->prepare(
                'INSERT INTO reporting_engagements
                 (client_id, name, report_type, legal_entity_codes, reporting_entity_code, sort_order)
                 VALUES (?, ?, ?, ?, ?, ?)'
            );
            foreach ($engagements as $i => $re) {
                $name       = trim($re['name'] ?? '');
                $reportType = in_array($re['report_type'] ?? '', ['consolidated', 'standalone'], true)
                              ? $re['report_type'] : 'consolidated';
                $legalCodes = isset($re['legal_entity_codes']) && is_array($re['legal_entity_codes'])
                              ? json_encode($re['legal_entity_codes']) : null;
                $entityCode = strtoupper(trim($re['reporting_entity_code'] ?? ''));
                if ($name === '' || $entityCode === '') continue;
                $insertRE->execute([$clientId, $name, $reportType, $legalCodes, $entityCode, $i]);
            }
        } catch (PDOException $e) {
            // Migration 002 not yet applied — skip silently
        }
    }

    // ── 6. Create team member accounts and send invite emails ────────────────────
    $teamMembers = $body['team_members'] ?? [];
    if (is_array($teamMembers) && count($teamMembers) > 0) {
        $config  = dolphin_config();
        $smtpCfg = $config['smtp'] ?? [];
        $baseUrl = rtrim($config['app_base_url'] ?? $config['platform_base_url'] ?? '', '/');

        $insertUser = $pdo->prepare(
            'INSERT IGNORE INTO users (email, password_hash, role, client_id, must_change_password)
             VALUES (?, ?, ?, ?, 1)'
        );

        foreach ($teamMembers as $tm) {
            $tmEmail = trim(strtolower($tm['email'] ?? ''));
            $tmName  = trim($tm['name']  ?? '');
            $tmRole  = in_array($tm['role'] ?? '', ['sustainability_team', 'client_uploader', 'client_leadership'], true)
                       ? $tm['role'] : 'client_leadership';

            if ($tmEmail === '' || !filter_var($tmEmail, FILTER_VALIDATE_EMAIL)) continue;
            if ($tmEmail === strtolower($user['email'])) continue; // skip — primary contact already has an account

            $tempPassword = bin2hex(random_bytes(8));
            try {
                $insertUser->execute([
                    $tmEmail,
                    password_hash($tempPassword, PASSWORD_BCRYPT),
                    $tmRole,
                    $clientId,
                ]);
            } catch (PDOException $e) {
                // User already exists — skip without failing the whole transaction
                continue;
            }

            // Send invite email via SMTP (non-fatal)
            if (!empty($smtpCfg['host']) && !empty($smtpCfg['username']) && !empty($smtpCfg['app_password'])) {
                try {
                    $smtp = new Smtp(
                        $smtpCfg['host'],
                        (int)($smtpCfg['port'] ?? 587),
                        $smtpCfg['username'],
                        $smtpCfg['app_password'],
                        $smtpCfg['from_email'] ?? $smtpCfg['username'],
                        $smtpCfg['from_name']  ?? 'Deepwoods Decarbonisation Portal',
                    );
                    $greeting = $tmName !== '' ? "Hello {$tmName}," : "Hello,";
                    $clientName = htmlspecialchars($companyName !== '' ? $companyName : 'your organisation');
                    $htmlBody = <<<HTML
<html><body style="font-family:Arial,sans-serif;color:#1a1a1a;max-width:560px;margin:0 auto;padding:24px">
<h2 style="color:#1E6F5C;margin-top:0">You've been added to the Decarbonisation Portal</h2>
<p>{$greeting}</p>
<p><strong>{$clientName}</strong> has added you to their workspace on the <strong>Deepwoods GHG &amp; Decarbonisation Portal</strong>. Your account is ready — log in using the credentials below.</p>
<table style="border-collapse:collapse;margin:20px 0;width:100%">
  <tr style="border-bottom:1px solid #E5E7EB">
    <td style="padding:10px 16px 10px 0;color:#6B7280;font-size:14px;white-space:nowrap">Login URL</td>
    <td style="padding:10px 0;font-size:14px"><a href="{$baseUrl}" style="color:#1E6F5C">{$baseUrl}</a></td>
  </tr>
  <tr style="border-bottom:1px solid #E5E7EB">
    <td style="padding:10px 16px 10px 0;color:#6B7280;font-size:14px;white-space:nowrap">Email</td>
    <td style="padding:10px 0;font-size:14px">{$tmEmail}</td>
  </tr>
  <tr>
    <td style="padding:10px 16px 10px 0;color:#6B7280;font-size:14px;white-space:nowrap">Temporary password</td>
    <td style="padding:10px 0;font-size:14px;font-weight:bold;font-family:monospace;letter-spacing:1px">{$tempPassword}</td>
  </tr>
</table>
<div style="background:#FEF3C7;border:1px solid #FDE68A;border-radius:8px;padding:12px 16px;font-size:13px;color:#92400E;margin:20px 0">
  <strong>You will be asked to set a new password</strong> the first time you log in.
</div>
<p style="font-size:12px;color:#9CA3AF;margin-top:32px;border-top:1px solid #F3F4F6;padding-top:16px">— Deepwoods Decarbonisation Portal · Automated message, please do not reply.</p>
</body></html>
HTML;
                    $smtp->send($tmEmail, "You've been added to the Decarbonisation Portal — {$clientName}", $htmlBody);
                } catch (Throwable $e) {
                    error_log('client-setup team invite email failed for ' . $tmEmail . ': ' . $e->getMessage());
                }
            }
        }
    }

    // ── 7. Save sub-entities (subsidiaries / divisions) to org_entities ─────────
    $subEntities = $body['sub_entities'] ?? [];
    if (is_array($subEntities) && count($subEntities) > 0) {
        try {
            // Remove any previously submitted sub-entities for this client so
            // a re-submission replaces them cleanly.
            $pdo->prepare('DELETE FROM org_entities WHERE client_id = ?')
                ->execute([$clientId]);

            $insertSub = $pdo->prepare(
                'INSERT INTO org_entities
                 (client_id, org_code, entity_code, entity_name, entity_type, gstin, billing_scope, sort_order)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
            );
            foreach ($subEntities as $i => $se) {
                $orgCode   = strtoupper(trim($se['org_code']     ?? ''));
                $entCode   = strtoupper(trim($se['entity_code']  ?? ''));
                $entName   = trim($se['entity_name']             ?? '');
                $entType   = trim($se['entity_type']             ?? 'subsidiary');
                $gstin     = trim($se['gstin']                   ?? '') ?: null;
                $billing   = in_array($se['billing_scope'] ?? '', ['consolidated', 'separate'], true)
                             ? $se['billing_scope'] : 'consolidated';
                if ($entName === '') continue;
                $insertSub->execute([
                    $clientId, $orgCode, $entCode ?: ($orgCode . 'SUB' . ($i + 1)),
                    $entName, strtolower($entType), $gstin, $billing, $i + 1,
                ]);
            }
        } catch (PDOException $e) {
            // org_entities migration not yet applied — skip silently
            error_log('client-setup sub_entities skip: ' . $e->getMessage());
        }
    }

    $pdo->commit();
    dolphin_send_json(['ok' => true, 'setup_complete' => true]);

} catch (PDOException $e) {
    $pdo->rollBack();
    error_log('client-setup.php error: ' . $e->getMessage());
    dolphin_send_json(['error' => 'Failed to save setup. Please try again.'], 500);
}
