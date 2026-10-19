<?php
// data-tracker/draft.php
// GET    ?entity=FP&fy=FY26  → { assetId: { period: value } }
// POST   { entity, fy, cells: [{ assetId, period, value }] }  → batch upsert
// DELETE ?entity=FP&fy=FY26  → wipe draft for this entity+fy (call after final submit)

declare(strict_types=1);
require_once __DIR__ . '/../db.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$user        = dolphin_require_auth();
dolphin_block_read_only_writes($user);
$clientId    = (int)($user['client_id'] ?? 0);
$editor      = $user['email'] ?? '';
$entityScope = $user['entity_scope'] ?? null; // non-null = user locked to one entity
if (!$clientId) { dolphin_send_json(['error' => 'User is not associated with a client'], 403); }

$pdo = dolphin_db();

/** Enforce entity_scope: returns the validated entity or dies 403. */
function dt_resolve_entity(string $requested, ?string $entityScope, int $clientId, PDO $pdo): string {
    // Scoped users are locked to their assigned entity regardless of the request
    if ($entityScope !== null) return $entityScope;
    if ($requested === '') dolphin_send_json(['error' => 'entity required'], 400);
    // Verify the requested entity belongs to this client
    $stmt = $pdo->prepare('SELECT code FROM client_entities WHERE client_id = ? AND code = ?');
    $stmt->execute([$clientId, $requested]);
    if (!$stmt->fetch()) dolphin_send_json(['error' => 'entity_forbidden'], 403);
    return $requested;
}

/** Client users cannot change data once Deepwoods has locked the reporting period. Staff bypass. */
function dt_assert_unlocked(PDO $pdo, array $user, int $clientId, string $entity, string $fy): void {
    if (in_array($user['role'] ?? '', ['deepwoods_admin', 'deepwoods_coordinator'], true)) return;
    try {
        $st = $pdo->prepare('SELECT status FROM reporting_cycles WHERE client_id = ? AND entity = ? AND fiscal_year = ?');
        $st->execute([$clientId, $entity, $fy]);
        if ($st->fetchColumn() === 'locked') {
            dolphin_send_json(['error' => 'This reporting period is locked. Ask your Deepwoods consultant to reopen it.'], 409);
        }
    } catch (PDOException $e) {
        // reporting_cycles missing (migration 010 not applied) — nothing to enforce
    }
}

// ── GET ────────────────────────────────────────────────────────────────────────

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $entity = dt_resolve_entity(trim($_GET['entity'] ?? ''), $entityScope, $clientId, $pdo);
    $fy     = trim($_GET['fy']     ?? '');
    if (!$fy) { dolphin_send_json(['error' => 'fy required'], 400); }

    $stmt = $pdo->prepare(
        'SELECT asset_id, period, value, edited_by, updated_at FROM tracker_drafts
         WHERE client_id = ? AND entity = ? AND fiscal_year = ?'
    );
    $stmt->execute([$clientId, $entity, $fy]);
    $rows = $stmt->fetchAll();

    // draft shape:    { [assetId]: { [period]: value } }
    // last_edits shape: { [assetId]: { edited_by, edited_at } } — latest cell per asset
    $draft      = [];
    $lastEdits  = [];
    foreach ($rows as $r) {
        $draft[$r['asset_id']][$r['period']] = $r['value'] ?? '';
        $existing = $lastEdits[$r['asset_id']] ?? null;
        if (!$existing || $r['updated_at'] > $existing['edited_at']) {
            $lastEdits[$r['asset_id']] = [
                'edited_by' => $r['edited_by'] ?? '',
                'edited_at' => $r['updated_at'],
            ];
        }
    }
    dolphin_send_json([
        'draft'      => $draft      ?: new stdClass(),
        'last_edits' => $lastEdits  ?: new stdClass(),
    ]);
}

// ── POST ───────────────────────────────────────────────────────────────────────

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body   = dolphin_json_body();
    $entity = dt_resolve_entity(trim($body['entity'] ?? ''), $entityScope, $clientId, $pdo);
    $fy     = trim($body['fy'] ?? '');
    $cells  = $body['cells'] ?? [];

    if (!$fy || !is_array($cells)) {
        dolphin_send_json(['error' => 'fy and cells[] required'], 400);
    }
    dt_assert_unlocked($pdo, $user, $clientId, $entity, $fy);

    $stmt = $pdo->prepare(
        'INSERT INTO tracker_drafts (client_id, entity, fiscal_year, asset_id, period, value, edited_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE value = VALUES(value), edited_by = VALUES(edited_by), updated_at = CURRENT_TIMESTAMP'
    );

    $pdo->beginTransaction();
    try {
        foreach ($cells as $cell) {
            $assetId = trim((string)($cell['assetId'] ?? ''));
            $period  = trim((string)($cell['period']  ?? ''));
            $value   = isset($cell['value']) ? (string)$cell['value'] : null;
            if (!$assetId || !$period) continue;
            $stmt->execute([$clientId, $entity, $fy, $assetId, $period, $value, $editor]);
        }
        $pdo->commit();
        dolphin_send_json(['ok' => true, 'saved' => count($cells)]);
    } catch (PDOException $e) {
        $pdo->rollBack();
        error_log('tracker_drafts POST error: ' . $e->getMessage());
        dolphin_send_json(['error' => 'Failed to save draft'], 500);
    }
}

// ── DELETE ─────────────────────────────────────────────────────────────────────

if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $entity = dt_resolve_entity(trim($_GET['entity'] ?? ''), $entityScope, $clientId, $pdo);
    $fy     = trim($_GET['fy'] ?? '');
    if (!$fy) { dolphin_send_json(['error' => 'fy required'], 400); }
    dt_assert_unlocked($pdo, $user, $clientId, $entity, $fy);

    $pdo->prepare(
        'DELETE FROM tracker_drafts WHERE client_id = ? AND entity = ? AND fiscal_year = ?'
    )->execute([$clientId, $entity, $fy]);

    dolphin_send_json(['ok' => true]);
}
