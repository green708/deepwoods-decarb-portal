<?php
// ghg/facilities.php — GET/POST/PUT/DELETE /backend/api/ghg/facilities.php

declare(strict_types=1);
require_once __DIR__ . '/../db.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$user      = dolphin_require_auth();
dolphin_block_read_only_writes($user);
dolphin_require_active_client($user);
$client_id = (int)($user['client_id'] ?? 0);

if (!$client_id) {
    echo json_encode([]);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$pdo    = dolphin_db();

// ── GET — list facilities ─────────────────────────────────────────────────────
if ($method === 'GET') {
    $entity = dolphin_validate_entity($user, trim($_GET['entity'] ?? '')) ?: null;
    $where  = 'client_id = ?';
    $params = [$client_id];
    if ($entity) { $where .= ' AND entity = ?'; $params[] = $entity; }

    // Ensure optional columns exist before selecting them
    try { $pdo->exec("ALTER TABLE ghg_facilities ADD COLUMN short_name VARCHAR(40) NULL"); } catch (PDOException $ae) {}
    try { $pdo->exec("ALTER TABLE ghg_facilities ADD COLUMN status VARCHAR(20) DEFAULT 'active'"); } catch (PDOException $ae) {}
    try { $pdo->exec("ALTER TABLE ghg_facilities ADD COLUMN is_hq TINYINT(1) NOT NULL DEFAULT 0"); } catch (PDOException $ae) {}

    $selectCols = "id, entity, name, COALESCE(short_name,'') AS short_name,
                   location, state, grid_utility, re_instrument,
                   COALESCE(status,'active') AS status,
                   COALESCE(is_hq, 0) AS is_hq";
    $stmt = $pdo->prepare("SELECT $selectCols FROM ghg_facilities WHERE $where ORDER BY is_hq DESC, entity, name");
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($rows as &$row) { $row['is_hq'] = (int)$row['is_hq']; }
    unset($row);
    echo json_encode($rows);
    exit;
}

// ── Shared: read JSON body ────────────────────────────────────────────────────
$body = json_decode(file_get_contents('php://input'), true) ?? [];

// ── POST — create facility ────────────────────────────────────────────────────
if ($method === 'POST') {
    // Ensure columns exist before we try to use them
    try { $pdo->exec("ALTER TABLE ghg_facilities ADD COLUMN short_name VARCHAR(40) NULL"); } catch (PDOException $ae) {}
    try { $pdo->exec("ALTER TABLE ghg_facilities ADD COLUMN status VARCHAR(20) DEFAULT 'active'"); } catch (PDOException $ae) {}
    try { $pdo->exec("ALTER TABLE ghg_facilities ADD COLUMN is_hq TINYINT(1) NOT NULL DEFAULT 0"); } catch (PDOException $ae) {}

    $name         = trim($body['name'] ?? '');
    $shortName    = trim($body['short_name'] ?? '');
    $entity       = strtoupper(trim($body['entity'] ?? ''));
    if ($entity === '') {
        http_response_code(422);
        echo json_encode(['error' => 'entity is required']);
        exit;
    }
    // Scoped users can only create facilities under their own entity —
    // this also forces the entity for scoped callers regardless of what was requested.
    $entity       = strtoupper(dolphin_validate_entity($user, $entity));
    $location     = trim($body['location'] ?? '');
    $state        = trim($body['state'] ?? '');
    $gridUtility  = trim($body['grid_utility'] ?? '');
    $reInstrument = trim($body['re_instrument'] ?? '');
    $status       = in_array($body['status'] ?? '', ['active', 'inactive'], true)
                    ? $body['status'] : 'active';
    $isHq         = !empty($body['is_hq']) ? 1 : 0;

    if ($name === '') {
        http_response_code(422);
        echo json_encode(['error' => 'name is required']);
        exit;
    }

    // If no short_name provided, derive from name
    if ($shortName === '') {
        $base = strtoupper(preg_replace('/[^a-zA-Z0-9]/', '', $name));
        $shortName = substr($base, 0, 12);
    }

    // Ensure short_name is unique within this entity (not the whole client account)
    $dup = $pdo->prepare('SELECT COUNT(*) FROM ghg_facilities WHERE client_id = ? AND entity = ? AND short_name = ?');
    $dup->execute([$client_id, $entity, $shortName]);
    if ((int)$dup->fetchColumn() > 0) {
        // Auto-suffix to make it unique
        $suffix = 2;
        $base   = $shortName;
        while (true) {
            $candidate = $base . $suffix;
            $dup2 = $pdo->prepare('SELECT COUNT(*) FROM ghg_facilities WHERE client_id = ? AND entity = ? AND short_name = ?');
            $dup2->execute([$client_id, $entity, $candidate]);
            if ((int)$dup2->fetchColumn() === 0) { $shortName = $candidate; break; }
            $suffix++;
        }
    }

    // If marking as HQ, clear the flag from other facilities for this entity
    if ($isHq) {
        $pdo->prepare('UPDATE ghg_facilities SET is_hq = 0 WHERE client_id = ? AND entity = ?')
            ->execute([$client_id, $entity]);
    }
    $pdo->prepare(
        'INSERT INTO ghg_facilities
         (client_id, entity, name, short_name, location, state, grid_utility, re_instrument, status, is_hq)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )->execute([$client_id, $entity, $name, $shortName, $location, $state, $gridUtility, $reInstrument, $status, $isHq]);
    $newId = (int)$pdo->lastInsertId();
    echo json_encode([
        'id' => $newId, 'entity' => $entity, 'name' => $name, 'short_name' => $shortName,
        'location' => $location, 'state' => $state,
        'grid_utility' => $gridUtility, 're_instrument' => $reInstrument, 'status' => $status, 'is_hq' => $isHq,
    ]);
    exit;
}

// ── PUT — update facility ─────────────────────────────────────────────────────
if ($method === 'PUT') {
    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) {
        http_response_code(422);
        echo json_encode(['error' => 'id is required']);
        exit;
    }
    $check = $pdo->prepare('SELECT id, entity FROM ghg_facilities WHERE id = ? AND client_id = ?');
    $check->execute([$id, $client_id]);
    $existing = $check->fetch();
    if (!$existing) {
        http_response_code(404);
        echo json_encode(['error' => 'Not found']);
        exit;
    }
    // Scoped users may only edit facilities that belong to their own entity
    if (!empty($user['entity_scope']) && $existing['entity'] !== $user['entity_scope']) {
        http_response_code(403);
        echo json_encode(['error' => 'Not authorised to edit this facility']);
        exit;
    }
    // A scoped user can't reassign a facility to a different entity
    if (array_key_exists('entity', $body)) {
        $body['entity'] = dolphin_validate_entity($user, strtoupper(trim((string)$body['entity'])));
    }

    // If marking as HQ, clear the flag from other facilities for this entity first
    if (!empty($body['is_hq'])) {
        $entityForHq = strtoupper(trim($body['entity'] ?? $check->fetchColumn() ?? ''));
        // Re-fetch entity of the row being edited
        $rowEntity = $pdo->prepare('SELECT entity FROM ghg_facilities WHERE id = ?');
        $rowEntity->execute([$id]);
        $entityForHq = $rowEntity->fetchColumn() ?: '';
        if ($entityForHq) {
            $pdo->prepare('UPDATE ghg_facilities SET is_hq = 0 WHERE client_id = ? AND entity = ? AND id != ?')
                ->execute([$client_id, $entityForHq, $id]);
        }
    }

    $fields  = [];
    $params  = [];
    $allowed = ['name', 'short_name', 'location', 'state', 'grid_utility', 're_instrument', 'entity'];
    foreach ($allowed as $col) {
        if (array_key_exists($col, $body)) {
            $val = trim((string)$body[$col]);
            // Validate short_name uniqueness on update (skip if same row)
            if ($col === 'short_name' && $val !== '') {
                $dup = $pdo->prepare('SELECT COUNT(*) FROM ghg_facilities WHERE client_id = ? AND short_name = ? AND id != ?');
                $dup->execute([$client_id, $val, $id]);
                if ((int)$dup->fetchColumn() > 0) {
                    http_response_code(422);
                    echo json_encode(['error' => "Short name '{$val}' already exists for this account. Please choose a different one."]);
                    exit;
                }
            }
            $fields[]  = "$col = ?";
            $params[]  = $val;
        }
    }
    // is_hq handled separately
    if (array_key_exists('is_hq', $body)) {
        try {
            $pdo->prepare("UPDATE ghg_facilities SET is_hq = ? WHERE id = ?")
                ->execute([$body['is_hq'] ? 1 : 0, $id]);
        } catch (PDOException $e) { /* column not yet added — ignore */ }
    }
    // status handled separately (may not exist as column)
    if (array_key_exists('status', $body) && in_array($body['status'], ['active', 'inactive'], true)) {
        try {
            $pdo->prepare("UPDATE ghg_facilities SET status = ? WHERE id = ?")
                ->execute([$body['status'], $id]);
        } catch (PDOException $e) { /* column not yet added — ignore */ }
    }

    if (!empty($fields)) {
        $params[] = $id;
        $pdo->prepare("UPDATE ghg_facilities SET " . implode(', ', $fields) . " WHERE id = ?")
            ->execute($params);
    }

    $row = $pdo->prepare(
        "SELECT id, entity, name, location, state, grid_utility, re_instrument,
                COALESCE(status, 'active') AS status
         FROM ghg_facilities WHERE id = ?"
    );
    $row->execute([$id]);
    echo json_encode($row->fetch(PDO::FETCH_ASSOC));
    exit;
}

// ── DELETE — remove facility ──────────────────────────────────────────────────
if ($method === 'DELETE') {
    $id = (int)($body['id'] ?? ($_GET['id'] ?? 0));
    if ($id <= 0) {
        http_response_code(422);
        echo json_encode(['error' => 'id is required']);
        exit;
    }
    $check = $pdo->prepare('SELECT id, entity FROM ghg_facilities WHERE id = ? AND client_id = ?');
    $check->execute([$id, $client_id]);
    $existing = $check->fetch();
    if (!$existing) {
        http_response_code(404);
        echo json_encode(['error' => 'Not found']);
        exit;
    }
    // Scoped users may only delete facilities that belong to their own entity
    if (!empty($user['entity_scope']) && $existing['entity'] !== $user['entity_scope']) {
        http_response_code(403);
        echo json_encode(['error' => 'Not authorised to delete this facility']);
        exit;
    }
    $pdo->prepare('DELETE FROM ghg_facilities WHERE id = ?')->execute([$id]);
    echo json_encode(['ok' => true]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
