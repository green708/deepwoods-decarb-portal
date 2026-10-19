<?php
// admin/actions.php — GET / POST / DELETE. Deepwoods staff manage a client's decarbonisation actions.

declare(strict_types=1);
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../lib_admin.php';
require_once __DIR__ . '/../lib_portal.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Headers: Content-Type, X-Api-Key, Authorization');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');

$user   = dolphin_require_auth();
dolphin_require_deepwoods($user);
$method = dolphin_require_method(['GET', 'POST', 'DELETE']);
$pdo    = dolphin_db();
$body   = $method === 'POST' ? dolphin_json_body() : null;
$clientId = dolphin_staff_client_id($body);
dolphin_client_or_404($pdo, $clientId);
$email = (string)$user['email'];

function action_shape(array $r): array {
    $num = static fn($v) => $v === null ? null : (float)$v;
    $fac = $r['facilities'] ? json_decode($r['facilities'], true) : [];
    return [
        'id'                 => (int)$r['id'],
        'entity'             => $r['entity'],
        'title'              => $r['title'],
        'description'        => $r['description'],
        'facilities'         => is_array($fac) ? array_values($fac) : [],
        'lever'              => $r['lever'],
        'status'             => $r['status'],
        'priority'           => $r['priority'],
        'abatement_t'        => $num($r['abatement_t']),
        'actual_abatement_t' => $num($r['actual_abatement_t']),
        'timeline'           => $r['timeline'],
        'owner'              => $r['owner'],
        'start_date'         => $r['start_date'],
        'end_date'           => $r['end_date'],
        'cost'               => $num($r['cost']),
        'updated_at'         => dolphin_iso($r['updated_at']),
    ];
}

function action_fetch(PDO $pdo, int $clientId, int $id): ?array {
    $st = $pdo->prepare('SELECT * FROM decarb_actions WHERE id = ? AND client_id = ?');
    $st->execute([$id, $clientId]);
    return $st->fetch() ?: null;
}

if ($method === 'GET') {
    $st = $pdo->prepare('SELECT * FROM decarb_actions WHERE client_id = ? ORDER BY id');
    $st->execute([$clientId]);
    dolphin_send_json([
        'actions'  => array_map('action_shape', $st->fetchAll()),
        'statuses' => ACTION_STATUSES,
    ]);
}

if ($method === 'DELETE') {
    dolphin_require_deepwoods($user, true);
    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) dolphin_send_json(['error' => 'id is required'], 400);
    $row = action_fetch($pdo, $clientId, $id);
    if (!$row) dolphin_send_json(['error' => 'Action not found'], 404);
    $pdo->prepare('DELETE FROM decarb_actions WHERE id = ? AND client_id = ?')->execute([$id, $clientId]);
    dolphin_log_activity($pdo, $clientId, $email, 'action_deleted', '#' . $id . ' ' . mb_substr((string)$row['title'], 0, 120));
    dolphin_send_json(['ok' => true]);
}

// ── POST (insert or update) ────────────────────────────────────────────────
$id = 0;
if (isset($body['id']) && $body['id'] !== '') {
    if (!is_scalar($body['id']) || !ctype_digit((string)$body['id']) || (int)$body['id'] <= 0) {
        dolphin_validation_failed(['id' => 'must be a positive integer']);
    }
    $id = (int)$body['id'];
}
$existing = null;
if ($id > 0) {
    $existing = action_fetch($pdo, $clientId, $id);
    if (!$existing) dolphin_send_json(['error' => 'Action not found for this client'], 404);
}

$maxLen = ['title' => 500, 'lever' => 100, 'timeline' => 100, 'owner' => 150, 'description' => 5000];
$vals   = [];     // column => value to store
$errors = [];

// Required on insert; on update they fall back to the stored value.
foreach (['entity', 'title', 'status', 'priority'] as $f) {
    if (array_key_exists($f, $body)) {
        $v = is_string($body[$f]) ? trim($body[$f]) : '';
        if ($v === '') $errors[$f] = 'required';
        else $vals[$f] = $v;
    } elseif ($existing) {
        $vals[$f] = (string)$existing[$f];
    } else {
        $errors[$f] = 'required';
    }
}
foreach ($maxLen as $f => $max) {
    if (array_key_exists($f, $body)) {
        if ($body[$f] !== null && !is_string($body[$f])) { $errors[$f] = 'must be a string'; continue; }
        $v = $body[$f] === null ? null : trim($body[$f]);
        if ($v === '') $v = null;
        if ($f === 'title') { if ($v !== null) $vals[$f] = $v; continue; }
        if ($v !== null && mb_strlen($v) > $max) { $errors[$f] = "too long (max $max characters)"; continue; }
        $vals[$f] = $v;
    } elseif ($existing) {
        $vals[$f] = $existing[$f];
    } else {
        $vals[$f] = null;
    }
}
if (isset($vals['title']) && mb_strlen($vals['title']) > 500) $errors['title'] = 'too long (max 500 characters)';

// Numbers
foreach (['abatement_t' => 99999999.99, 'actual_abatement_t' => 999999999999.99, 'cost' => 999999999999.99] as $f => $max) {
    if (array_key_exists($f, $body)) {
        $raw = $body[$f];
        if ($raw === null || $raw === '') { $vals[$f] = null; continue; }
        if (is_bool($raw) || !is_numeric($raw) || (float)$raw < 0 || (float)$raw > $max) { $errors[$f] = 'must be a non-negative number'; continue; }
        $vals[$f] = round((float)$raw, 2);
    } else {
        $vals[$f] = $existing[$f] ?? null;
    }
}

// Dates
foreach (['start_date', 'end_date'] as $f) {
    if (array_key_exists($f, $body)) {
        $raw = $body[$f];
        if ($raw === null || $raw === '') { $vals[$f] = null; continue; }
        if (!dolphin_valid_date($raw)) { $errors[$f] = 'must be YYYY-MM-DD or null'; continue; }
        $vals[$f] = $raw;
    } else {
        $vals[$f] = $existing[$f] ?? null;
    }
}
if (!isset($errors['start_date']) && !isset($errors['end_date']) && $vals['start_date'] && $vals['end_date'] && $vals['end_date'] < $vals['start_date']) {
    $errors['end_date'] = 'must not be before start_date';
}

// Facilities
if (array_key_exists('facilities', $body)) {
    $f = $body['facilities'];
    if ($f === null) {
        $vals['facilities'] = null;
    } elseif (!is_array($f) || count($f) > 200) {
        $errors['facilities'] = 'must be an array of strings';
    } else {
        $clean = [];
        foreach ($f as $item) {
            if (!is_string($item) || mb_strlen(trim($item)) > 255) { $errors['facilities'] = 'must be an array of strings (max 255 characters each)'; break; }
            if (trim($item) !== '') $clean[] = trim($item);
        }
        $vals['facilities'] = $clean ? json_encode(array_values($clean)) : null;
    }
} else {
    $vals['facilities'] = $existing['facilities'] ?? null;
}

// Enumerations and references
if (!isset($errors['status']) && !in_array($vals['status'], ACTION_STATUSES, true)) {
    $errors['status'] = 'must be one of ' . implode(', ', ACTION_STATUSES);
}
if (!isset($errors['priority']) && !in_array($vals['priority'], ['High', 'Medium', 'Low'], true)) {
    $errors['priority'] = 'must be High, Medium or Low';
}
if (!isset($errors['entity']) && $vals['entity'] !== 'All') {
    $st = $pdo->prepare('SELECT 1 FROM client_entities WHERE client_id = ? AND code = ?');
    $st->execute([$clientId, $vals['entity']]);
    if (!$st->fetchColumn()) $errors['entity'] = "must be an entity code of this client or 'All'";
}
if ($errors) dolphin_validation_failed($errors);

$cols = ['entity', 'title', 'description', 'facilities', 'lever', 'status', 'priority', 'abatement_t',
         'actual_abatement_t', 'timeline', 'owner', 'start_date', 'end_date', 'cost'];
try {
    if ($existing) {
        $set = implode(', ', array_map(static fn($c) => "$c = ?", $cols));
        $params = array_map(static fn($c) => $vals[$c], $cols);
        $params[] = $id; $params[] = $clientId;
        $pdo->prepare("UPDATE decarb_actions SET $set WHERE id = ? AND client_id = ?")->execute($params);
        $saved = $id;
        dolphin_log_activity($pdo, $clientId, $email, 'action_updated', '#' . $id . ' ' . mb_substr($vals['title'], 0, 120));
    } else {
        $params = array_merge([$clientId], array_map(static fn($c) => $vals[$c], $cols));
        $pdo->prepare(
            'INSERT INTO decarb_actions (client_id, ' . implode(', ', $cols) . ') VALUES (?' . str_repeat(', ?', count($cols)) . ')'
        )->execute($params);
        $saved = (int)$pdo->lastInsertId();
        dolphin_log_activity($pdo, $clientId, $email, 'action_created', '#' . $saved . ' ' . mb_substr($vals['title'], 0, 120));
    }
} catch (PDOException $e) {
    error_log('admin/actions save failed: ' . $e->getMessage());
    dolphin_send_json(['error' => 'Failed to save action'], 500);
}

dolphin_send_json(action_shape(action_fetch($pdo, $clientId, $saved)));
