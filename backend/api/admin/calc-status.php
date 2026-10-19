<?php
// admin/calc-status.php — GET / POST. Per-entity calculation lifecycle: draft -> calculated -> verified -> locked.

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
$isAdmin = $user['role'] === 'deepwoods_admin';
$body   = $method === 'POST' ? dolphin_json_body() : null;
$clientId = dolphin_staff_client_id($body);
$client   = dolphin_client_or_404($pdo, $clientId);

/** One entity's calc row in the response shape (virtual draft when no row exists). */
function calc_row_shape(array $entity, ?array $r, bool $hasData): array {
    return [
        'entity'        => $entity['code'],
        'entity_name'   => $entity['name'],
        'status'        => $r['status'] ?? 'draft',
        'calculated_at' => dolphin_iso($r['calculated_at'] ?? null),
        'verified_at'   => dolphin_iso($r['verified_at'] ?? null),
        'verified_by'   => $r['verified_by'] ?? null,
        'ef_version'    => $r['ef_version'] ?? null,
        'notes'         => $r['notes'] ?? null,
        'updated_by'    => $r['updated_by'] ?? null,
        'updated_at'    => dolphin_iso($r['updated_at'] ?? null),
        'has_data'      => $hasData,
    ];
}

function calc_has_data(PDO $pdo, int $clientId, string $entity, string $fy): bool {
    $st = $pdo->prepare('SELECT 1 FROM ghg_inventory WHERE client_id = ? AND entity = ? AND year = ? LIMIT 1');
    $st->execute([$clientId, $entity, $fy]);
    return (bool)$st->fetchColumn();
}

if ($method === 'GET') {
    $config = dolphin_client_config($pdo, $clientId);
    $fy = trim((string)($_GET['fy'] ?? ''));
    if ($fy === '') $fy = dolphin_client_fy($client, $config);
    if (!dolphin_valid_fy($fy)) dolphin_send_json(['error' => 'Invalid fy'], 400);

    $entities = dolphin_reporting_entities($pdo, $clientId);

    $st = $pdo->prepare('SELECT * FROM calc_status WHERE client_id = ? AND fiscal_year = ?');
    $st->execute([$clientId, $fy]);
    $byEntity = [];
    foreach ($st->fetchAll() as $r) $byEntity[$r['entity']] = $r;

    $st = $pdo->prepare('SELECT DISTINCT entity FROM ghg_inventory WHERE client_id = ? AND year = ?');
    $st->execute([$clientId, $fy]);
    $withData = array_flip($st->fetchAll(PDO::FETCH_COLUMN));

    $out = [];
    foreach ($entities as $e) {
        $out[] = calc_row_shape($e, $byEntity[$e['code']] ?? null, isset($withData[$e['code']]));
    }
    dolphin_send_json(['fy' => $fy, 'entities' => $out]);
}

// ── POST ────────────────────────────────────────────────────────────────────
$entityCode = trim((string)($body['entity'] ?? ''));
$fy         = trim((string)($body['fiscal_year'] ?? ''));
$newStatus  = (string)($body['status'] ?? '');
$errors = [];
if ($entityCode === '') $errors['entity'] = 'required';
if (!dolphin_valid_fy($fy)) $errors['fiscal_year'] = 'must look like FY26 or CY2025';
if (!in_array($newStatus, CALC_STATUSES, true)) $errors['status'] = 'must be one of ' . implode(', ', CALC_STATUSES);
foreach (['ef_version' => 100, 'notes' => 5000] as $f => $max) {
    if (array_key_exists($f, $body) && $body[$f] !== null) {
        if (!is_string($body[$f])) $errors[$f] = 'must be a string';
        elseif (mb_strlen($body[$f]) > $max) $errors[$f] = "too long (max $max characters)";
    }
}
if ($errors) dolphin_validation_failed($errors);

$entity = null;
foreach (dolphin_reporting_entities($pdo, $clientId) as $e) {
    if ($e['code'] === $entityCode) { $entity = $e; break; }
}
if (!$entity) dolphin_send_json(['error' => 'Entity not found for this client (consolidated entities have no calculation status)'], 404);

$email = (string)$user['email'];
$pdo->beginTransaction();
try {
    $st = $pdo->prepare('SELECT * FROM calc_status WHERE client_id = ? AND entity = ? AND fiscal_year = ? FOR UPDATE');
    $st->execute([$clientId, $entityCode, $fy]);
    $row = $st->fetch() ?: null;
    $cur = $row['status'] ?? 'draft';

    if ($newStatus !== $cur) {
        $rank = array_flip(CALC_STATUSES);
        if ($newStatus === 'draft') {
            if (in_array($cur, ['verified', 'locked'], true) && !$isAdmin) {
                $pdo->rollBack();
                dolphin_send_json(['error' => "Only a deepwoods_admin can reopen a $cur calculation"], 403);
            }
        } elseif ($rank[$newStatus] !== $rank[$cur] + 1) {
            $pdo->rollBack();
            dolphin_send_json(['error' => "Illegal transition $cur -> $newStatus; move one step at a time (draft -> calculated -> verified -> locked) or reopen to draft"], 400);
        } elseif (in_array($newStatus, ['verified', 'locked'], true) && !$isAdmin) {
            $pdo->rollBack();
            dolphin_send_json(['error' => "Only a deepwoods_admin can set status $newStatus"], 403);
        } elseif ($newStatus === 'verified' && empty($row['calculated_at'])) {
            $pdo->rollBack();
            dolphin_send_json(['error' => 'Cannot verify: the entity has no calculated_at timestamp'], 400);
        }
    }

    $sets = []; $vals = [];
    if ($newStatus !== $cur) {
        $sets[] = 'status = ?'; $vals[] = $newStatus;
        if ($newStatus === 'calculated') {
            $sets[] = 'calculated_at = NOW()';
        } elseif ($newStatus === 'verified') {
            $sets[] = 'verified_at = NOW()'; $sets[] = 'verified_by = ?'; $vals[] = $email;
        } elseif ($newStatus === 'draft') {
            $sets[] = 'verified_at = NULL'; $sets[] = 'verified_by = NULL';
        }
    }
    foreach (['ef_version', 'notes'] as $f) {
        if (array_key_exists($f, $body)) {
            $v = $body[$f] === null ? null : trim((string)$body[$f]);
            $sets[] = "$f = ?"; $vals[] = ($v === '' ? null : $v);
        }
    }
    $sets[] = 'updated_by = ?'; $vals[] = $email;

    if ($row) {
        $vals[] = (int)$row['id'];
        $pdo->prepare('UPDATE calc_status SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($vals);
    } else {
        $pdo->prepare('INSERT IGNORE INTO calc_status (client_id, entity, fiscal_year, status) VALUES (?, ?, ?, ?)')
            ->execute([$clientId, $entityCode, $fy, 'draft']);
        $st = $pdo->prepare('SELECT id FROM calc_status WHERE client_id = ? AND entity = ? AND fiscal_year = ? FOR UPDATE');
        $st->execute([$clientId, $entityCode, $fy]);
        $vals[] = (int)$st->fetchColumn();
        $pdo->prepare('UPDATE calc_status SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($vals);
    }
    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('calc-status save failed: ' . $e->getMessage());
    dolphin_send_json(['error' => 'Failed to save calculation status'], 500);
}

if ($newStatus !== $cur) {
    dolphin_log_activity($pdo, $clientId, $email, 'calc_status', "$entityCode $fy: $cur -> $newStatus");
} else {
    dolphin_log_activity($pdo, $clientId, $email, 'calc_status', "$entityCode $fy: details updated");
}

$st = $pdo->prepare('SELECT * FROM calc_status WHERE client_id = ? AND entity = ? AND fiscal_year = ?');
$st->execute([$clientId, $entityCode, $fy]);
dolphin_send_json(calc_row_shape($entity, $st->fetch() ?: null, calc_has_data($pdo, $clientId, $entityCode, $fy)));
