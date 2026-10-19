<?php
// admin-entities.php — Deepwoods admin: view & edit client_entities across all clients
// GET  → list all client entities with their client name
// PUT  → update code and/or short_name for one entity row

declare(strict_types=1);
require_once __DIR__ . '/db.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Allow-Methods: GET, PUT, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$user = dolphin_require_auth();
if (!in_array($user['role'] ?? '', ['deepwoods_admin', 'deepwoods_coordinator'], true)) {
    dolphin_send_json(['error' => 'Admin access required'], 403);
}

$pdo    = dolphin_db();
$method = $_SERVER['REQUEST_METHOD'];

// ── GET — list all client entities ───────────────────────────────────────────
if ($method === 'GET') {
    $onlyClient = isset($_GET['client_id']) ? (int)$_GET['client_id'] : 0;
    $stmt = $pdo->prepare(
        'SELECT ce.id, ce.client_id, c.name AS client_name, c.slug AS client_slug,
                ce.code, ce.name AS entity_name,
                COALESCE(ce.short_name, "") AS short_name,
                ce.is_consolidated, ce.legal_address,
                COALESCE(ce.org_type, "") AS org_type
         FROM client_entities ce
         JOIN clients c ON c.id = ce.client_id
         WHERE (? = 0 OR ce.client_id = ?)
         ORDER BY c.name, ce.is_consolidated DESC, ce.code'
    );
    $stmt->execute([$onlyClient, $onlyClient]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Codes used by more than one client, computed over ALL clients so a per-client filter keeps the warning accurate.
    $dupCodes = array_flip($pdo->query(
        'SELECT code FROM client_entities GROUP BY code HAVING COUNT(DISTINCT client_id) > 1'
    )->fetchAll(PDO::FETCH_COLUMN));
    foreach ($rows as &$r) {
        $r['code_duplicate'] = isset($dupCodes[$r['code']]);
        $r['is_consolidated'] = (bool)$r['is_consolidated'];
    }
    unset($r);

    dolphin_send_json($rows);
}

// ── PUT — update one entity's code and/or short_name ─────────────────────────
if ($method === 'PUT') {
    $body = dolphin_json_body();
    $id   = (int)($body['id'] ?? 0);
    if ($id <= 0) {
        dolphin_send_json(['error' => 'id required'], 422);
    }

    // Verify the row exists
    $check = $pdo->prepare('SELECT id, client_id, code FROM client_entities WHERE id = ?');
    $check->execute([$id]);
    $existing = $check->fetch(PDO::FETCH_ASSOC);
    if (!$existing) {
        dolphin_send_json(['error' => 'Entity not found'], 404);
    }

    $fields = [];
    $params = [];

    if (array_key_exists('code', $body)) {
        $newCode = strtoupper(trim((string)$body['code']));
        if ($newCode === '') {
            dolphin_send_json(['error' => 'code cannot be empty'], 422);
        }
        // Unique within this client (exclude self)
        $dup = $pdo->prepare(
            'SELECT COUNT(*) FROM client_entities WHERE client_id = ? AND code = ? AND id != ?'
        );
        $dup->execute([$existing['client_id'], $newCode, $id]);
        if ((int)$dup->fetchColumn() > 0) {
            dolphin_send_json([
                'error' => "Code '{$newCode}' is already used by another entity in this client.",
                'field' => 'code',
            ], 422);
        }
        $fields[] = 'code = ?';
        $params[] = $newCode;

        // Cascade: update ghg_facilities.entity so asset IDs stay consistent
        $oldCode = $existing['code'];
        if ($oldCode !== $newCode) {
            try {
                $pdo->prepare(
                    'UPDATE ghg_facilities SET entity = ? WHERE client_id = ? AND entity = ?'
                )->execute([$newCode, $existing['client_id'], $oldCode]);
            } catch (PDOException $ce) { /* ghg_facilities may not exist yet */ }
        }
    }

    if (array_key_exists('short_name', $body)) {
        $fields[] = 'short_name = ?';
        $params[] = trim((string)$body['short_name']);
    }

    if (array_key_exists('org_type', $body)) {
        $fields[] = 'org_type = ?';
        $params[] = trim((string)$body['org_type']) ?: null;
    }

    if (empty($fields)) {
        dolphin_send_json(['error' => 'Nothing to update'], 400);
    }

    $params[] = $id;
    try {
        $pdo->prepare('UPDATE client_entities SET ' . implode(', ', $fields) . ' WHERE id = ?')
            ->execute($params);
    } catch (PDOException $e) {
        error_log('admin-entities PUT failed: ' . $e->getMessage());
        dolphin_send_json(['error' => 'Could not save the entity. Check the values and try again.'], 500);
    }

    // Return updated row
    $row = $pdo->prepare(
        'SELECT ce.id, ce.client_id, c.name AS client_name, c.slug AS client_slug,
                ce.code, ce.name AS entity_name,
                COALESCE(ce.short_name, "") AS short_name,
                ce.is_consolidated, ce.legal_address,
                COALESCE(ce.org_type, "") AS org_type
         FROM client_entities ce
         JOIN clients c ON c.id = ce.client_id
         WHERE ce.id = ?'
    );
    $row->execute([$id]);
    dolphin_send_json($row->fetch(PDO::FETCH_ASSOC));
}

http_response_code(405);
dolphin_send_json(['error' => 'Method not allowed']);
