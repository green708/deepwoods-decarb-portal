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
// Entity-scoped admins manage their own entity via ghg/facilities.php and team.php —
// this endpoint creates/renames entities and can touch ANY entity's facilities, so it's
// org-admin only. Without this check, an entity admin could rewrite or wipe another
// entity's data by calling this endpoint directly.
if (!empty($user['entity_scope'])) {
    dolphin_send_json(['error' => 'Entity admins cannot configure client-level or other entities\' settings. Contact your org admin.'], 403);
}

$body = dolphin_json_body();

$tag = "[client-setup client={$clientId} user={$user['email']}]";
error_log("{$tag} START — company=" . ($body['company_name'] ?? '?')
    . " facilities=" . count($body['facilities'] ?? [])
    . " entities=" . count($body['entities'] ?? [])
    . " team=" . count($body['team_members'] ?? [])
    . " logo=" . (isset($body['logo_url']) ? (str_starts_with((string)$body['logo_url'], 'data:') ? 'base64(' . strlen((string)$body['logo_url']) . 'b)' : 'url') : 'none')
);

$pdo = dolphin_db();

$currentStep = 'init';
try {
    $pdo->beginTransaction();

    // ── 1. Update the clients row ──────────────────────────────────────────────
    $currentStep = '1-update-clients';

    $companyName  = trim($body['company_name'] ?? '');
    $currency     = in_array($body['currency'] ?? '', ['INR', 'USD'], true) ? $body['currency'] : 'INR';
    $logoUrl      = isset($body['logo_url']) ? (string)$body['logo_url'] : null;
    // Base64 data URIs from the logo uploader won't fit in VARCHAR(500) — skip them.
    // Logos should be uploaded via a dedicated file endpoint, not embedded in setup JSON.
    if ($logoUrl !== null && str_starts_with($logoUrl, 'data:')) {
        error_log("{$tag} step1 — logo_url is base64 (" . strlen($logoUrl) . " bytes), skipping to avoid VARCHAR overflow");
        $logoUrl = null;
    }
    $primaryColor = isset($body['primary_color']) ? trim((string)$body['primary_color']) : null;

    $reportingPeriod = in_array($body['reporting_period'] ?? '', ['FY', 'CY'], true)
                       ? $body['reporting_period'] : null;

    $clientSets   = ['currency = ?'];
    $clientParams = [$currency];

    if ($reportingPeriod !== null) {
        $clientSets[]   = 'reporting_period = ?';
        $clientParams[] = $reportingPeriod;
    }

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
    $sql = 'UPDATE clients SET ' . implode(', ', $clientSets) . ' WHERE id = ?';
    error_log("{$tag} step1 — SQL: {$sql}");
    $pdo->prepare($sql)->execute($clientParams);
    error_log("{$tag} step1 — clients row updated OK");

    // ── 2. Persist config keys ────────────────────────────────────────────────
    $currentStep = '2-client-config';

    $configKeys = [
        'industry'                => $body['industry']              ?? null,
        'operating_name'          => isset($body['operating_name']) ? trim($body['operating_name']) : null,
        'country'                 => $body['country']               ?? null,
        'is_msme'                 => isset($body['is_msme'])        ? ($body['is_msme'] ? '1' : '0') : null,
        'udyam_number'            => isset($body['udyam_number'])   ? trim($body['udyam_number'])   : null,
        'website'                 => isset($body['website'])        ? trim($body['website'])        : null,
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
        'primary_contact_email'   => $user['email'],
        'selected_plan'           => trim($body['selected_plan'] ?? 'professional') ?: 'professional',
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
    error_log("{$tag} step2 — config keys upserted OK (" . count(array_filter($configKeys, fn($v) => $v !== null)) . " keys)");

    // ── 3. Add new entities ──────────────────────────────────────────────────
    $currentStep = '3-client-entities';

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

        $inserted = 0;
        foreach ($newEntities as $i => $ent) {
            $code  = strtoupper(trim($ent['code']  ?? ''));
            $name  = trim($ent['name']       ?? '');
            $short = trim($ent['short_name'] ?? $code);
            $isConsolidated = !empty($ent['is_consolidated']) ? 1 : 0;

            if ($code === '' || $name === '') continue;

            $insertEntity->execute([
                $clientId, $code, $name, $short, $isConsolidated, $maxOrder + $i + 1
            ]);
            $inserted++;
        }
        error_log("{$tag} step3 — {$inserted} entities upserted OK");
    } else {
        error_log("{$tag} step3 — no entities in payload, skipped");
    }

    // ── 3.5. Invite the entity admin for a newly added entity ──────────────────
    // Fires as soon as the entity row above is committed — this is the person
    // the org admin names while registering the entity, not a later /team invite.
    // $entityAdminInvite is reported back in the response so the org admin gets
    // visible feedback (and a manual-share temp password) if the invite fails,
    // instead of the entity silently ending up with no admin.
    $currentStep = '3.5-entity-admin-invite';

    $entityAdminInvite = null;
    $entityAdminEmail = trim(strtolower($body['entity_admin_email'] ?? ''));
    if ($entityAdminEmail !== '' && isset($body['entities'][0]['code'])) {
        $newEntityCode = strtoupper(trim($body['entities'][0]['code']));
        $newEntityName = trim($body['entities'][0]['name'] ?? $newEntityCode);

        if (!filter_var($entityAdminEmail, FILTER_VALIDATE_EMAIL)) {
            error_log("{$tag} step3.5 — skipping invalid entity admin email: '{$entityAdminEmail}'");
            $entityAdminInvite = ['email' => $entityAdminEmail, 'created' => false, 'email_sent' => false, 'error' => 'Invalid email address'];
        } elseif ($entityAdminEmail === strtolower($user['email'])) {
            error_log("{$tag} step3.5 — skipping entity admin invite, matches primary contact: {$entityAdminEmail}");
            $entityAdminInvite = ['email' => $entityAdminEmail, 'created' => false, 'email_sent' => false, 'error' => 'That is your own account email'];
        } else {
            $tempPassword = bin2hex(random_bytes(8));
            try {
                $pdo->prepare(
                    'INSERT INTO users (email, password_hash, role, client_id, entity_scope, must_change_password)
                     VALUES (?, ?, ?, ?, ?, 1)'
                )->execute([
                    $entityAdminEmail,
                    password_hash($tempPassword, PASSWORD_BCRYPT),
                    'sustainability_team',
                    $clientId,
                    $newEntityCode,
                ]);
                error_log("{$tag} step3.5 — entity admin account created: {$entityAdminEmail} entity={$newEntityCode}");

                $config  = dolphin_config();
                $smtpCfg = $config['smtp'] ?? [];
                $baseUrl = rtrim($config['app_base_url'] ?? $config['platform_base_url'] ?? '', '/');

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
                        $clientNameStmt = $pdo->prepare('SELECT name FROM clients WHERE id = ?');
                        $clientNameStmt->execute([$clientId]);
                        $clientName     = htmlspecialchars((string)($clientNameStmt->fetchColumn() ?: 'your organisation'));
                        $entityNameSafe = htmlspecialchars($newEntityName);

                        $htmlBody = <<<HTML
<html><body style="font-family:Arial,sans-serif;color:#1a1a1a;max-width:560px;margin:0 auto;padding:24px">
<h2 style="color:#1E6F5C;margin-top:0">You've been added as Entity Admin</h2>
<p>Hello,</p>
<p>You've been added to the <strong>{$clientName}</strong> workspace on the Deepwoods GHG &amp; Decarbonisation Portal as the <strong>Entity Admin</strong> for <strong>{$entityNameSafe}</strong>. You'll manage this entity's facilities and team, and submit its data.</p>
<table style="border-collapse:collapse;margin:20px 0;width:100%">
  <tr style="border-bottom:1px solid #E5E7EB">
    <td style="padding:10px 16px 10px 0;color:#6B7280;font-size:14px;white-space:nowrap">Login URL</td>
    <td style="padding:10px 0;font-size:14px"><a href="{$baseUrl}" style="color:#1E6F5C">{$baseUrl}</a></td>
  </tr>
  <tr style="border-bottom:1px solid #E5E7EB">
    <td style="padding:10px 16px 10px 0;color:#6B7280;font-size:14px;white-space:nowrap">Email</td>
    <td style="padding:10px 0;font-size:14px">{$entityAdminEmail}</td>
  </tr>
  <tr>
    <td style="padding:10px 16px 10px 0;color:#6B7280;font-size:14px;white-space:nowrap">Temporary password</td>
    <td style="padding:10px 0;font-size:14px;font-weight:bold;font-family:monospace;letter-spacing:1px">{$tempPassword}</td>
  </tr>
</table>
<div style="background:#FEF3C7;border:1px solid #FDE68A;border-radius:8px;padding:12px 16px;font-size:13px;color:#92400E;margin:20px 0">
  <strong>Important:</strong> You will be asked to set a new password on your first login. Please do this immediately.
</div>
<p style="font-size:13px;color:#6B7280">If you were not expecting this invitation, please contact your team administrator.</p>
<p style="font-size:12px;color:#9CA3AF;margin-top:32px;border-top:1px solid #F3F4F6;padding-top:16px">— Deepwoods Decarbonisation Portal · This is an automated message, please do not reply.</p>
</body></html>
HTML;
                        $smtp->send($entityAdminEmail, "You've been added as Entity Admin — {$clientName}", $htmlBody);
                        error_log("{$tag} step3.5 — invite email sent to {$entityAdminEmail}");
                        $entityAdminInvite = ['email' => $entityAdminEmail, 'created' => true, 'email_sent' => true];
                    } catch (Throwable $e) {
                        error_log("{$tag} step3.5 — invite email FAILED for {$entityAdminEmail}: " . $e->getMessage());
                        $entityAdminInvite = ['email' => $entityAdminEmail, 'created' => true, 'email_sent' => false, 'temp_password' => $tempPassword];
                    }
                } else {
                    error_log("{$tag} step3.5 — SMTP not configured, skipping invite email for {$entityAdminEmail}");
                    $entityAdminInvite = ['email' => $entityAdminEmail, 'created' => true, 'email_sent' => false, 'temp_password' => $tempPassword];
                }
            } catch (PDOException $e) {
                if ($e->getCode() === '23000') {
                    error_log("{$tag} step3.5 — account already exists, skipped: {$entityAdminEmail}");
                    $entityAdminInvite = ['email' => $entityAdminEmail, 'created' => false, 'email_sent' => false, 'error' => 'An account with that email already exists'];
                } else {
                    error_log("{$tag} step3.5 — entity admin user insert failed: " . $e->getMessage());
                    $entityAdminInvite = ['email' => $entityAdminEmail, 'created' => false, 'email_sent' => false, 'error' => 'Could not create the account'];
                }
            }
        }
    }

    // ── 4. Update legal entity detail columns ─────────────────────────────────
    $currentStep = '4-legal-entities';

    $legal_entities = $body['legal_entities'] ?? [];
    if (is_array($legal_entities) && count($legal_entities) > 0) {
        try {
            $updateLegal = $pdo->prepare(
                'UPDATE client_entities
                 SET country = ?, registration_no = ?, tax_id = ?, org_type = ?, legal_address = ?
                 WHERE client_id = ? AND code = ?'
            );
            $updated = 0;
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
                $updated++;
            }
            error_log("{$tag} step4 — {$updated} legal entities updated OK");
        } catch (PDOException $e) {
            error_log("{$tag} step4 — skipped (migration 002 not applied?): " . $e->getMessage());
        }
    }

    // ── 5. Replace reporting_engagements ──────────────────────────────────────
    $currentStep = '5-reporting-engagements';

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
            $inserted = 0;
            foreach ($engagements as $i => $re) {
                $name       = trim($re['name'] ?? '');
                $reportType = in_array($re['report_type'] ?? '', ['consolidated', 'standalone'], true)
                              ? $re['report_type'] : 'consolidated';
                $legalCodes = isset($re['legal_entity_codes']) && is_array($re['legal_entity_codes'])
                              ? json_encode($re['legal_entity_codes']) : null;
                $entityCode = strtoupper(trim($re['reporting_entity_code'] ?? ''));
                if ($name === '' || $entityCode === '') continue;
                $insertRE->execute([$clientId, $name, $reportType, $legalCodes, $entityCode, $i]);
                $inserted++;
            }
            error_log("{$tag} step5 — {$inserted} reporting engagements inserted OK");
        } catch (PDOException $e) {
            error_log("{$tag} step5 — skipped (migration 002 not applied?): " . $e->getMessage());
        }
    }

    // ── 5.5. Save facilities to ghg_facilities ────────────────────────────────
    $currentStep = '5.5-ghg-facilities';

    $facilitiesInput = $body['facilities'] ?? [];
    if (is_array($facilitiesInput) && count($facilitiesInput) > 0) {
        $parentEntityCode = '';
        if (isset($body['entities'][0]['code'])) {
            $parentEntityCode = strtoupper(trim($body['entities'][0]['code']));
        }
        error_log("{$tag} step5.5 — saving " . count($facilitiesInput) . " facilities, entity={$parentEntityCode}");

        try {
            // Scope the wipe to THIS entity's facilities only — don't touch other entities' facilities.
            if ($parentEntityCode !== '') {
                $pdo->prepare('DELETE FROM ghg_facilities WHERE client_id = ? AND entity = ?')
                    ->execute([$clientId, $parentEntityCode]);
            } else {
                $pdo->prepare('DELETE FROM ghg_facilities WHERE client_id = ?')->execute([$clientId]);
            }
        } catch (PDOException $e) {
            error_log("{$tag} step5.5 — DELETE ghg_facilities failed (table missing?): " . $e->getMessage());
        }

        try {
            $insertFacility = $pdo->prepare(
                'INSERT INTO ghg_facilities (client_id, entity, name, short_name, location, status)
                 VALUES (?, ?, ?, ?, ?, ?)'
            );
            $usedShortNames = [];
            $inserted = 0;
            foreach ($facilitiesInput as $fac) {
                $facName     = trim($fac['name']     ?? '');
                $facLocation = trim($fac['location'] ?? $fac['address'] ?? '');
                if ($facName === '') continue;

                $base      = strtoupper(preg_replace('/[^a-zA-Z0-9]/', '', $facName));
                $candidate = substr($base, 0, 10) ?: 'FAC';
                $shortName = $candidate;
                $suffix    = 2;
                while (in_array($shortName, $usedShortNames, true)) {
                    $shortName = substr($candidate, 0, 8) . $suffix;
                    $suffix++;
                }
                $usedShortNames[] = $shortName;

                try {
                    $insertFacility->execute([$clientId, $parentEntityCode, $facName, $shortName, $facLocation, 'active']);
                    $inserted++;
                } catch (PDOException $e) {
                    error_log("{$tag} step5.5 — facility insert failed (short_name fallback): name={$facName} err=" . $e->getMessage());
                    try {
                        $pdo->prepare('INSERT INTO ghg_facilities (client_id, entity, name, location) VALUES (?, ?, ?, ?)')
                            ->execute([$clientId, $parentEntityCode, $facName, $facLocation]);
                        $inserted++;
                    } catch (PDOException $e2) {
                        error_log("{$tag} step5.5 — facility fallback insert also failed: " . $e2->getMessage());
                    }
                }
            }
            try {
                $pdo->prepare(
                    'UPDATE ghg_facilities SET is_hq = 1
                     WHERE client_id = ? AND entity = ? ORDER BY id ASC LIMIT 1'
                )->execute([$clientId, $parentEntityCode]);
            } catch (PDOException $e) {
                // is_hq column is added lazily by ghg/facilities.php; absent on fresh DBs
            }
            error_log("{$tag} step5.5 — {$inserted} facilities inserted OK");
        } catch (PDOException $e) {
            error_log("{$tag} step5.5 — prepare failed (ghg_facilities table missing on server?): " . $e->getMessage());
        }
    }

    // ── 6. Create team member accounts and send invite emails ─────────────────
    $currentStep = '6-team-members';

    $teamMembers = $body['team_members'] ?? [];
    if (is_array($teamMembers) && count($teamMembers) > 0) {
        $config  = dolphin_config();
        $smtpCfg = $config['smtp'] ?? [];
        $baseUrl = rtrim($config['app_base_url'] ?? $config['platform_base_url'] ?? '', '/');

        $insertUser = $pdo->prepare(
            'INSERT IGNORE INTO users (email, password_hash, role, client_id, must_change_password)
             VALUES (?, ?, ?, ?, 1)'
        );

        $created = 0;
        foreach ($teamMembers as $tm) {
            $tmEmail = trim(strtolower($tm['email'] ?? ''));
            $tmName  = trim($tm['name']  ?? '');
            $tmRole  = in_array($tm['role'] ?? '', ['sustainability_team', 'client_uploader', 'client_leadership'], true)
                       ? $tm['role'] : 'client_leadership';

            if ($tmEmail === '' || !filter_var($tmEmail, FILTER_VALIDATE_EMAIL)) {
                error_log("{$tag} step6 — skipping invalid email: '{$tmEmail}'");
                continue;
            }
            if ($tmEmail === strtolower($user['email'])) {
                error_log("{$tag} step6 — skipping primary contact (already has account): {$tmEmail}");
                continue;
            }

            $tempPassword = bin2hex(random_bytes(8));
            try {
                $insertUser->execute([
                    $tmEmail,
                    password_hash($tempPassword, PASSWORD_BCRYPT),
                    $tmRole,
                    $clientId,
                ]);
                $created++;
                error_log("{$tag} step6 — user created: {$tmEmail} role={$tmRole}");
            } catch (PDOException $e) {
                error_log("{$tag} step6 — user insert failed for {$tmEmail}: " . $e->getMessage());
                continue;
            }

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
                    $greeting   = $tmName !== '' ? "Hello {$tmName}," : "Hello,";
                    $clientName = htmlspecialchars($companyName !== '' ? $companyName : 'your organisation');
                    $roleLabel  = [
                        'sustainability_team' => 'Admin',
                        'client_uploader'     => 'Data Contributor',
                        'client_leadership'   => 'Viewer',
                    ][$tmRole] ?? $tmRole;
                    $htmlBody = <<<HTML
<html><body style="font-family:Arial,sans-serif;color:#1a1a1a;max-width:560px;margin:0 auto;padding:24px">
<h2 style="color:#1E6F5C;margin-top:0">You've been added to the Decarbonisation Portal</h2>
<p>{$greeting}</p>
<p><strong>{$clientName}</strong> has added you to their workspace on the <strong>Deepwoods GHG &amp; Decarbonisation Portal</strong> as <strong>{$roleLabel}</strong>. Your account is ready — log in using the credentials below.</p>
<table style="border-collapse:collapse;margin:20px 0;width:100%">
  <tr style="border-bottom:1px solid #E5E7EB">
    <td style="padding:10px 16px 10px 0;color:#6B7280;font-size:14px;white-space:nowrap">Login URL</td>
    <td style="padding:10px 0;font-size:14px"><a href="{$baseUrl}" style="color:#1E6F5C">{$baseUrl}</a></td>
  </tr>
  <tr style="border-bottom:1px solid #E5E7EB">
    <td style="padding:10px 16px 10px 0;color:#6B7280;font-size:14px;white-space:nowrap">Email</td>
    <td style="padding:10px 0;font-size:14px">{$tmEmail}</td>
  </tr>
  <tr style="border-bottom:1px solid #E5E7EB">
    <td style="padding:10px 16px 10px 0;color:#6B7280;font-size:14px;white-space:nowrap">Role</td>
    <td style="padding:10px 0;font-size:14px">{$roleLabel}</td>
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
                    error_log("{$tag} step6 — invite email sent to {$tmEmail}");
                } catch (Throwable $e) {
                    error_log("{$tag} step6 — invite email FAILED for {$tmEmail}: " . $e->getMessage());
                }
            } else {
                error_log("{$tag} step6 — SMTP not configured, skipping invite email for {$tmEmail}");
            }
        }
        error_log("{$tag} step6 — {$created} team accounts created");
    }

    // ── 7. Save sub-entities (subsidiaries / divisions) to org_entities ────────
    $currentStep = '7-org-entities';

    $subEntities = $body['sub_entities'] ?? [];
    if (is_array($subEntities) && count($subEntities) > 0) {
        try {
            $pdo->prepare('DELETE FROM org_entities WHERE client_id = ?')
                ->execute([$clientId]);

            $insertSub = $pdo->prepare(
                'INSERT INTO org_entities
                 (client_id, org_code, entity_code, entity_name, entity_type, gstin, billing_scope, sort_order)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
            );
            $inserted = 0;
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
                $inserted++;
            }
            error_log("{$tag} step7 — {$inserted} sub-entities inserted OK");
        } catch (PDOException $e) {
            error_log("{$tag} step7 — skipped (org_entities migration not applied?): " . $e->getMessage());
        }
    }

    $pdo->commit();
    error_log("{$tag} COMMIT OK — setup complete");

    // ── Admin notification email ───────────────────────────────────────────────
    $planMap = [
        'starter'      => 'Starter — ₹75,000/year',
        'growth'       => 'Growth — ₹1,75,000/year',
        'professional' => 'Professional — ₹3,50,000/year (Most Popular)',
        'enterprise'   => 'Enterprise — Custom pricing',
    ];
    $selectedPlan = trim($body['selected_plan'] ?? 'professional') ?: 'professional';
    $planLabel    = $planMap[$selectedPlan] ?? ucfirst($selectedPlan);
    $adminCfg     = dolphin_config();
    $adminEmail   = $adminCfg['admin_email'] ?? ($adminCfg['smtp']['username'] ?? null);
    $smtpCfg      = $adminCfg['smtp'] ?? [];
    if ($adminEmail && !empty($smtpCfg['host']) && !empty($smtpCfg['username']) && !empty($smtpCfg['app_password'])) {
        try {
            require_once __DIR__ . '/Smtp.php';
            $smtp = new Smtp(
                $smtpCfg['host'],
                (int)($smtpCfg['port'] ?? 587),
                $smtpCfg['username'],
                $smtpCfg['app_password'],
                $smtpCfg['from_email'] ?? $smtpCfg['username'],
                $smtpCfg['from_name']  ?? 'Deepwoods Decarbonisation Portal',
            );
            $cName    = htmlspecialchars($body['company_name'] ?? '');
            $industry = htmlspecialchars($body['industry']     ?? '—');
            $country  = htmlspecialchars($body['country']      ?? '—');
            $contact  = htmlspecialchars($user['email']        ?? '');
            $fCount   = (int)($body['facility_count'] ?? 1);
            $planHtml = htmlspecialchars($planLabel);
            $setupHtml = <<<HTML
<html><body style="font-family:Arial,sans-serif;color:#1a1a1a;max-width:600px;margin:0 auto;padding:0">
<div style="background:#1E6F5C;padding:24px 32px;border-radius:8px 8px 0 0">
  <p style="margin:0;font-size:20px;font-weight:700;color:#fff">Deepwoods Decarb Portal</p>
  <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.8)">New client setup completed</p>
</div>
<div style="background:#f9fafb;padding:24px 32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
  <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13.5px;border-collapse:collapse">
    <tr><td style="padding:8px 0;color:#6b7280;width:160px">Company</td><td style="padding:8px 0;font-weight:600">{$cName}</td></tr>
    <tr><td style="padding:8px 0;color:#6b7280">Industry</td><td style="padding:8px 0">{$industry}</td></tr>
    <tr><td style="padding:8px 0;color:#6b7280">Country</td><td style="padding:8px 0">{$country}</td></tr>
    <tr><td style="padding:8px 0;color:#6b7280">Facilities</td><td style="padding:8px 0">{$fCount}</td></tr>
    <tr><td style="padding:8px 0;color:#6b7280">Primary contact</td><td style="padding:8px 0">{$contact}</td></tr>
  </table>
  <div style="margin-top:16px;padding:14px 18px;background:#ECF7F3;border:1px solid #C5E4D0;border-radius:8px">
    <p style="margin:0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#1E6F5C;margin-bottom:4px">Selected Plan</p>
    <p style="margin:0;font-size:16px;font-weight:700;color:#1E4D2B">{$planHtml}</p>
  </div>
  <p style="margin:20px 0 0;font-size:12px;color:#9CA3AF">Log in to the admin panel to review and approve this registration.</p>
</div>
</body></html>
HTML;
            $smtp->send($adminEmail, "New setup complete — {$cName} selected {$planLabel}", $setupHtml);
            error_log("{$tag} admin notify email sent to {$adminEmail}");
        } catch (Throwable $e) {
            error_log("{$tag} admin notify email FAILED: " . $e->getMessage());
        }
    }

    dolphin_send_json(['ok' => true, 'setup_complete' => true, 'entity_admin_invite' => $entityAdminInvite]);

} catch (Throwable $e) {
    try { $pdo->rollBack(); } catch (Throwable $_) {}
    $msg = $e->getMessage();
    $cls = get_class($e);
    error_log("{$tag} FATAL [{$cls}] at step [{$currentStep}]: {$msg}");
    dolphin_send_json([
        'error'      => 'Failed to save setup. Please try again.',
        'debug_step' => $currentStep,
        'debug_class'=> $cls,
        'debug_msg'  => $msg,
    ], 500);
}
