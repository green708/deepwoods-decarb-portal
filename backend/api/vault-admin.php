<?php
// vault-admin.php — Deepwoods-only endpoint for managing client vault documents.
// GET  ?client_id=X[&entity=Y][&fy=Z] — list docs for a client
// POST { client_id, entity, year, title, doc_type, drive_link } — add a document
// DELETE { id } — remove a document

declare(strict_types=1);
require_once __DIR__ . '/db.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$user = dolphin_require_auth();
if (!in_array($user['role'] ?? '', ['deepwoods_admin', 'deepwoods_coordinator', 'sustainability_team'], true)) {
    dolphin_send_json(['error' => 'Insufficient permissions'], 403);
}

$pdo = dolphin_db();

$isStaff = in_array($user['role'] ?? '', ['deepwoods_admin', 'deepwoods_coordinator'], true);
// Client roles are locked to their own client; only staff may name another client.
$ownClientId = (int)($user['client_id'] ?? 0);
if (!$isStaff && !$ownClientId) { dolphin_send_json(['error' => 'User is not associated with a client'], 403); }

// ── GET — list docs for a client ──────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $clientId = $isStaff ? (int)($_GET['client_id'] ?? 0) : $ownClientId;
    if (!$clientId) { dolphin_send_json(['error' => 'client_id required'], 400); }

    $sql    = 'SELECT id, entity, year AS fy, title, doc_type, drive_link, uploaded_at
               FROM vault_documents WHERE client_id = ?';
    $params = [$clientId];
    if (!empty($_GET['entity'])) { $sql .= ' AND entity = ?'; $params[] = trim($_GET['entity']); }
    if (!empty($_GET['fy']))     { $sql .= ' AND year = ?';   $params[] = trim($_GET['fy']);     }
    $sql .= ' ORDER BY uploaded_at DESC';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    dolphin_send_json($stmt->fetchAll(PDO::FETCH_ASSOC));
}

// ── POST — add a document ─────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body     = dolphin_json_body();
    $clientId = $isStaff ? (int)($body['client_id'] ?? 0) : $ownClientId;
    $entity   = trim($body['entity']     ?? '');
    $year     = trim($body['year']       ?? '');
    $title    = trim($body['title']      ?? '');
    $docType  = trim($body['doc_type']   ?? 'Report');
    $link     = trim($body['drive_link'] ?? '');

    if (!$clientId || !$entity || !$year || !$title) {
        dolphin_send_json(['error' => 'client_id, entity, year, and title are required'], 400);
    }

    // Verify client exists
    $cc = $pdo->prepare('SELECT id FROM clients WHERE id = ?');
    $cc->execute([$clientId]);
    if (!$cc->fetch()) { dolphin_send_json(['error' => 'client not found'], 404); }

    // Verify entity belongs to client
    $ce = $pdo->prepare('SELECT code FROM client_entities WHERE client_id = ? AND code = ?');
    $ce->execute([$clientId, $entity]);
    if (!$ce->fetch()) { dolphin_send_json(['error' => 'entity not found for this client'], 403); }

    $ins = $pdo->prepare(
        'INSERT INTO vault_documents (client_id, entity, year, title, doc_type, drive_link)
         VALUES (?,?,?,?,?,?)'
    );
    $ins->execute([$clientId, $entity, $year, $title, $docType, $link ?: null]);
    $newId = (int)$pdo->lastInsertId();

    dolphin_send_json(['ok' => true, 'id' => $newId]);
}

// ── DELETE — remove a document ────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $body = dolphin_json_body();
    $id   = (int)($body['id'] ?? 0);
    if (!$id) { dolphin_send_json(['error' => 'id required'], 400); }

    // For non-deepwoods roles, restrict to own client
    if ($isStaff) {
        $del = $pdo->prepare('DELETE FROM vault_documents WHERE id = ?');
        $del->execute([$id]);
    } else {
        $del = $pdo->prepare('DELETE FROM vault_documents WHERE id = ? AND client_id = ?');
        $del->execute([$id, $ownClientId]);
    }

    dolphin_send_json(['ok' => true, 'deleted' => $del->rowCount()]);
}

dolphin_send_json(['error' => 'Method not allowed'], 405);
