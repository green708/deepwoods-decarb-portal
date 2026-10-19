<?php
// cycle-submit.php — POST {entity, fy}. A client marks its data for an entity + fiscal year as submitted.
// Idempotent: submitting again only refreshes submitted_at / submitted_by. Reopening is staff-only (admin/cycles.php).

declare(strict_types=1);
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/lib_admin.php';
require_once __DIR__ . '/lib_portal.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Headers: Content-Type, X-Api-Key, Authorization');
header('Access-Control-Allow-Methods: POST, OPTIONS');

$user = dolphin_require_auth();
dolphin_require_method(['POST']);

if (!in_array($user['role'] ?? '', ['sustainability_team', 'client_uploader'], true)) {
    dolphin_send_json(['error' => 'Your role cannot submit data for the reporting cycle'], 403);
}
dolphin_require_active_client($user);
dolphin_require_payment($user);
$clientId = (int)($user['client_id'] ?? 0);
if (!$clientId) dolphin_send_json(['error' => 'No client associated with this account'], 403);
$pdo   = dolphin_db();
$email = (string)$user['email'];

$body      = dolphin_json_body();
$entityReq = trim((string)($body['entity'] ?? ''));
$fy        = trim((string)($body['fy'] ?? ''));
$errors = [];
if ($entityReq === '') $errors['entity'] = 'required';
if (!dolphin_valid_fy($fy)) $errors['fy'] = 'must look like FY26 or CY2025';
if ($errors) dolphin_validation_failed($errors);

$entity = dolphin_validate_entity($user, $entityReq);

$st = $pdo->prepare('SELECT code, name, is_consolidated FROM client_entities WHERE client_id = ? AND code = ?');
$st->execute([$clientId, $entity]);
$row = $st->fetch();
if (!$row) dolphin_send_json(['error' => 'entity_forbidden', 'message' => 'You do not have access to the requested entity.'], 403);
if ((int)$row['is_consolidated'] === 1) {
    dolphin_send_json(['error' => 'The consolidated entity cannot be submitted; submit each reporting entity'], 400);
}

$pdo->beginTransaction();
try {
    $st = $pdo->prepare('SELECT id, status FROM reporting_cycles WHERE client_id = ? AND entity = ? AND fiscal_year = ? FOR UPDATE');
    $st->execute([$clientId, $entity, $fy]);
    $cur = $st->fetch();
    if ($cur && $cur['status'] === 'locked') {
        $pdo->rollBack();
        dolphin_send_json(['error' => 'This reporting cycle is locked. Contact your Deepwoods consultant to reopen it.'], 409);
    }
    if (!$cur) {
        $pdo->prepare('INSERT IGNORE INTO reporting_cycles (client_id, entity, fiscal_year, status) VALUES (?, ?, ?, ?)')
            ->execute([$clientId, $entity, $fy, 'open']);
        $st = $pdo->prepare('SELECT id, status FROM reporting_cycles WHERE client_id = ? AND entity = ? AND fiscal_year = ? FOR UPDATE');
        $st->execute([$clientId, $entity, $fy]);
        $cur = $st->fetch();
        if ($cur['status'] === 'locked') {
            $pdo->rollBack();
            dolphin_send_json(['error' => 'This reporting cycle is locked. Contact your Deepwoods consultant to reopen it.'], 409);
        }
    }
    $pdo->prepare(
        "UPDATE reporting_cycles SET status = 'submitted', submitted_at = NOW(), submitted_by = ?, updated_by = ? WHERE id = ?"
    )->execute([$email, $email, (int)$cur['id']]);
    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('cycle-submit failed: ' . $e->getMessage());
    dolphin_send_json(['error' => 'Failed to submit'], 500);
}

dolphin_log_activity($pdo, $clientId, $email, 'cycle_submitted', "$entity $fy");

$cl = $pdo->prepare('SELECT name FROM clients WHERE id = ?');
$cl->execute([$clientId]);
$clientName = htmlspecialchars((string)($cl->fetchColumn() ?: 'A client'), ENT_QUOTES);
$cfg     = dolphin_config();
$baseUrl = rtrim($cfg['app_base_url'] ?? $cfg['platform_base_url'] ?? 'https://decarb.deepwoodsgreen.com', '/');
$by      = htmlspecialchars($email, ENT_QUOTES);
$entHtml = htmlspecialchars($entity, ENT_QUOTES);
$fyHtml  = htmlspecialchars($fy, ENT_QUOTES);
dolphin_notify_staff($pdo, "[Data submitted] $clientName ($entity, $fy)", <<<HTML
<p style="font-family:sans-serif;font-size:14px;color:#222;"><strong>{$clientName}</strong> has submitted its data for review.</p>
<table cellpadding="6" style="font-family:sans-serif;font-size:13px;color:#444;border-collapse:collapse;">
  <tr><td><strong>Entity</strong></td><td>{$entHtml}</td></tr>
  <tr><td><strong>Fiscal year</strong></td><td>{$fyHtml}</td></tr>
  <tr><td><strong>Submitted by</strong></td><td>{$by}</td></tr>
</table>
<p><a href="{$baseUrl}/admin" style="background:#1E6F5C;color:#fff;padding:9px 20px;border-radius:6px;text-decoration:none;font-family:sans-serif;font-weight:bold;font-size:13px;display:inline-block;">Open Admin Portfolio</a></p>
HTML);

$st = $pdo->prepare('SELECT status, data_due_date, report_due_date, submitted_at, submitted_by FROM reporting_cycles WHERE client_id = ? AND entity = ? AND fiscal_year = ?');
$st->execute([$clientId, $entity, $fy]);
dolphin_send_json(['ok' => true, 'cycle' => dolphin_agg_cycle([$st->fetch()], dolphin_today())]);
