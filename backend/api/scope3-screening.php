<?php
// scope3-screening.php
// GET  — load screening for a (client, entity) pair.
//         Admin:  ?client_id=X&entity_code=Y
//         Client: no params (uses own client_id; entity_code required: ?entity_code=Y)
// POST — save screening for a (client, entity) pair. Admin only.
//         Body: { client_id, entity_code, screening: (string|null)[15], notes: (string|null)[15] }
//
// Storage keys in client_config:
//   s3_screening_per_entity — JSON object: { "FP": { screening:[15], notes:[15] }, ... }
//   s3_not_relevant         — JSON object: { "FP": ["Cat 7","Cat 11"], ... }  (derived, read by context.php)

declare(strict_types=1);
require_once __DIR__ . '/db.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$user    = dolphin_require_auth();
$role    = $user['role'] ?? '';
$isAdmin = in_array($role, ['deepwoods_admin', 'deepwoods_coordinator'], true);

// ── helpers ───────────────────────────────────────────────────────────────────

function load_per_entity(PDO $pdo, int $clientId): array {
    $stmt = $pdo->prepare(
        "SELECT config_value FROM client_config WHERE client_id = ? AND config_key = 's3_screening_per_entity'"
    );
    $stmt->execute([$clientId]);
    $row = $stmt->fetchColumn();
    return $row ? (json_decode($row, true) ?? []) : [];
}

function save_per_entity(PDO $pdo, int $clientId, array $perEntity): void {
    $pdo->prepare(
        'INSERT INTO client_config (client_id, config_key, config_value)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)'
    )->execute([$clientId, 's3_screening_per_entity', json_encode($perEntity)]);

    // Derive s3_not_relevant: entity → ["Cat N", ...] for not_relevant categories
    $notRelevant = [];
    foreach ($perEntity as $code => $data) {
        $nrCats = [];
        foreach (($data['screening'] ?? []) as $i => $val) {
            if ($val === 'not_relevant') {
                $nrCats[] = 'Cat ' . ($i + 1);
            }
        }
        $notRelevant[$code] = $nrCats;
    }
    $pdo->prepare(
        'INSERT INTO client_config (client_id, config_key, config_value)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)'
    )->execute([$clientId, 's3_not_relevant', json_encode($notRelevant)]);

    // Also keep s3_boundary (union of all relevant/unsure across all entities) for legacy reads
    $boundarySet = [];
    foreach ($perEntity as $data) {
        foreach (($data['screening'] ?? []) as $i => $val) {
            if ($val === 'relevant' || $val === 'unsure') {
                $boundarySet['Cat ' . ($i + 1)] = true;
            }
        }
    }
    $boundary = array_keys($boundarySet);
    $pdo->prepare(
        'INSERT INTO client_config (client_id, config_key, config_value)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)'
    )->execute([$clientId, 's3_boundary', json_encode($boundary)]);
}

// ── GET ───────────────────────────────────────────────────────────────────────

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $entityCode = $_GET['entity_code'] ?? null;

    if ($isAdmin) {
        $targetId = (int)($_GET['client_id'] ?? 0);
        if (!$targetId) { dolphin_send_json(['error' => 'client_id required for admin'], 400); }
    } else {
        $targetId = (int)($user['client_id'] ?? 0);
        if (!$targetId) { dolphin_send_json(['error' => 'Forbidden'], 403); }
    }

    $pdo = dolphin_db();

    if ($entityCode) {
        // Return screening for a specific entity
        $perEntity  = load_per_entity($pdo, $targetId);
        $entityData = $perEntity[$entityCode] ?? ['screening' => array_fill(0, 15, null), 'notes' => array_fill(0, 15, null)];
        dolphin_send_json([
            'screening'    => $entityData['screening'] ?? array_fill(0, 15, null),
            'notes'        => $entityData['notes']     ?? array_fill(0, 15, null),
            'entity_code'  => $entityCode,
        ]);
    } else {
        // Legacy: return flat screening for backward compat (Operational Control panel)
        $stmt = $pdo->prepare(
            "SELECT config_key, config_value FROM client_config
             WHERE client_id = ? AND config_key IN ('s3_screening_raw','s3_boundary','s3_screening_notes','s3_screening_per_entity')"
        );
        $stmt->execute([$targetId]);
        $config = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $config[$row['config_key']] = json_decode($row['config_value'], true);
        }
        dolphin_send_json([
            'screening'        => $config['s3_screening_raw']        ?? null,
            's3_boundary'      => $config['s3_boundary']             ?? null,
            'notes'            => $config['s3_screening_notes']      ?? null,
            'per_entity'       => $config['s3_screening_per_entity'] ?? null,
        ]);
    }
}

// ── POST ──────────────────────────────────────────────────────────────────────

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    dolphin_send_json(['error' => 'GET or POST only'], 405);
}

if (!$isAdmin) {
    dolphin_send_json(['error' => 'Forbidden'], 403);
}

$body       = dolphin_json_body();
$targetId   = (int)($body['client_id'] ?? 0);
$entityCode = trim($body['entity_code'] ?? '');
$screening  = $body['screening'] ?? null;
$notes      = $body['notes'] ?? null;

if (!$targetId || !$entityCode || !is_array($screening) || count($screening) < 15) {
    dolphin_send_json(['error' => 'client_id, entity_code and 15-element screening array required'], 400);
}

$pdo       = dolphin_db();
$perEntity = load_per_entity($pdo, $targetId);

$perEntity[$entityCode] = [
    'screening' => array_slice($screening, 0, 15),
    'notes'     => is_array($notes) ? array_slice($notes, 0, 15) : array_fill(0, 15, null),
];

save_per_entity($pdo, $targetId, $perEntity);

dolphin_send_json(['ok' => true, 'entity_code' => $entityCode]);
