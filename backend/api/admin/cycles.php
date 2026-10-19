<?php
// admin/cycles.php — GET / POST. Per-entity reporting cycle: due dates and open / submitted / locked state.

declare(strict_types=1);
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../lib_admin.php';
require_once __DIR__ . '/../lib_portal.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Headers: Content-Type, X-Api-Key, Authorization');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');

$user   = dolphin_require_auth();
dolphin_require_deepwoods($user);
$method = dolphin_require_method(['GET', 'POST']);
$pdo    = dolphin_db();
$body   = $method === 'POST' ? dolphin_json_body() : null;
$clientId = dolphin_staff_client_id($body);
$client   = dolphin_client_or_404($pdo, $clientId);
$email    = (string)$user['email'];

function cycle_rows(PDO $pdo, int $clientId, string $fy): array {
    $entities = dolphin_reporting_entities($pdo, $clientId);
    $st = $pdo->prepare('SELECT * FROM reporting_cycles WHERE client_id = ? AND fiscal_year = ?');
    $st->execute([$clientId, $fy]);
    $by = [];
    foreach ($st->fetchAll() as $r) $by[$r['entity']] = $r;
    $out = [];
    foreach ($entities as $e) {
        $r = $by[$e['code']] ?? null;
        $out[] = [
            'entity'          => $e['code'],
            'entity_name'     => $e['name'],
            'status'          => $r['status'] ?? 'open',
            'data_due_date'   => $r['data_due_date'] ?? null,
            'report_due_date' => $r['report_due_date'] ?? null,
            'submitted_at'    => dolphin_iso($r['submitted_at'] ?? null),
            'submitted_by'    => $r['submitted_by'] ?? null,
            'notes'           => $r['notes'] ?? null,
        ];
    }
    return $out;
}

if ($method === 'GET') {
    $fy = trim((string)($_GET['fy'] ?? ''));
    if ($fy === '') $fy = dolphin_client_fy($client, dolphin_client_config($pdo, $clientId));
    if (!dolphin_valid_fy($fy)) dolphin_send_json(['error' => 'Invalid fy'], 400);
    dolphin_send_json(['fy' => $fy, 'entities' => cycle_rows($pdo, $clientId, $fy)]);
}

// ── POST ────────────────────────────────────────────────────────────────────
$fy     = trim((string)($body['fiscal_year'] ?? ''));
$target = trim((string)($body['entity'] ?? ''));
$errors = [];
if (!dolphin_valid_fy($fy)) $errors['fiscal_year'] = 'must look like FY26 or CY2025';
if ($target === '') $errors['entity'] = 'required (entity code or "*")';

$setData   = array_key_exists('data_due_date', $body ?? []);
$setReport = array_key_exists('report_due_date', $body ?? []);
$setNotes  = array_key_exists('notes', $body ?? []);
$dataDue   = $setData ? ($body['data_due_date'] === '' ? null : $body['data_due_date']) : null;
$reportDue = $setReport ? ($body['report_due_date'] === '' ? null : $body['report_due_date']) : null;
if ($setData && $dataDue !== null && !dolphin_valid_date($dataDue)) $errors['data_due_date'] = 'must be YYYY-MM-DD or null';
if ($setReport && $reportDue !== null && !dolphin_valid_date($reportDue)) $errors['report_due_date'] = 'must be YYYY-MM-DD or null';
$notes = null;
if ($setNotes) {
    if ($body['notes'] !== null && !is_string($body['notes'])) $errors['notes'] = 'must be a string or null';
    elseif (is_string($body['notes']) && mb_strlen($body['notes']) > 5000) $errors['notes'] = 'too long (max 5000 characters)';
    else $notes = $body['notes'] === null || trim($body['notes']) === '' ? null : trim($body['notes']);
}
$newStatus = $body['status'] ?? null;
if ($newStatus !== null && (!is_string($newStatus) || !in_array($newStatus, CYCLE_STATUSES, true))) {
    $errors['status'] = 'must be one of ' . implode(', ', CYCLE_STATUSES);
}
if ($errors) dolphin_validation_failed($errors);

$all = dolphin_reporting_entities($pdo, $clientId);
if ($target === '*') {
    $codes = array_column($all, 'code');
    if (!$codes) dolphin_send_json(['error' => 'Client has no reporting entities'], 400);
} else {
    $codes = in_array($target, array_column($all, 'code'), true) ? [$target] : [];
    if (!$codes) dolphin_send_json(['error' => 'Entity not found for this client (consolidated entities have no reporting cycle)'], 404);
}

$reopened = []; $locked = []; $updated = [];
$pdo->beginTransaction();
try {
    foreach ($codes as $code) {
        $st = $pdo->prepare('SELECT * FROM reporting_cycles WHERE client_id = ? AND entity = ? AND fiscal_year = ? FOR UPDATE');
        $st->execute([$clientId, $code, $fy]);
        $row = $st->fetch() ?: null;
        $cur = $row['status'] ?? 'open';

        $sets = []; $vals = [];
        if ($setData)   { $sets[] = 'data_due_date = ?';   $vals[] = $dataDue; }
        if ($setReport) { $sets[] = 'report_due_date = ?'; $vals[] = $reportDue; }
        if ($setNotes)  { $sets[] = 'notes = ?';           $vals[] = $notes; }
        if ($newStatus !== null && $newStatus !== $cur) {
            $sets[] = 'status = ?'; $vals[] = $newStatus;
            if ($newStatus === 'open') {
                $sets[] = 'submitted_at = NULL'; $sets[] = 'submitted_by = NULL';
                $reopened[] = $code;
            } elseif ($newStatus === 'submitted') {
                $sets[] = 'submitted_at = NOW()'; $sets[] = 'submitted_by = ?'; $vals[] = $email;
                $updated[] = $code;
            } else {
                $locked[] = $code;
            }
        } elseif ($setData || $setReport || $setNotes) {
            $updated[] = $code;
        }
        if (!$sets) continue;
        $sets[] = 'updated_by = ?'; $vals[] = $email;

        if ($row) {
            $vals[] = (int)$row['id'];
        } else {
            $pdo->prepare('INSERT IGNORE INTO reporting_cycles (client_id, entity, fiscal_year, status) VALUES (?, ?, ?, ?)')
                ->execute([$clientId, $code, $fy, 'open']);
            $st = $pdo->prepare('SELECT id FROM reporting_cycles WHERE client_id = ? AND entity = ? AND fiscal_year = ? FOR UPDATE');
            $st->execute([$clientId, $code, $fy]);
            $vals[] = (int)$st->fetchColumn();
        }
        $pdo->prepare('UPDATE reporting_cycles SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($vals);
    }
    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('cycles save failed: ' . $e->getMessage());
    dolphin_send_json(['error' => 'Failed to save reporting cycle'], 500);
}

$fmt = static fn(array $c): string => implode(',', $c);
if ($reopened) dolphin_log_activity($pdo, $clientId, $email, 'cycle_reopened', $fmt($reopened) . " $fy");
if ($locked)   dolphin_log_activity($pdo, $clientId, $email, 'cycle_locked', $fmt($locked) . " $fy");
if ($updated)  dolphin_log_activity($pdo, $clientId, $email, 'cycle_updated', $fmt($updated) . " $fy");

dolphin_send_json(['ok' => true, 'fy' => $fy, 'entities' => cycle_rows($pdo, $clientId, $fy)]);
