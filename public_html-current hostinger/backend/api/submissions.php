<?php
declare(strict_types=1);
require __DIR__ . '/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    dolphin_send_json(['error' => 'GET only'], 405);
}

$authUser = dolphin_require_auth();
dolphin_require_active_client($authUser);
dolphin_require_payment($authUser);

$pdo      = dolphin_db();
$clientId = (int)($authUser['client_id'] ?? 0);
if (!$clientId) { dolphin_send_json([]); }

$status = $_GET['status'] ?? null;
// dolphin_validate_entity enforces scope and verifies entity belongs to this client
$scopedEntity = dolphin_validate_entity($authUser, isset($_GET['entity']) ? strtoupper($_GET['entity']) : '') ?: null;

$sql    = 'SELECT s.* FROM submissions s WHERE s.client_id = ?';
$params = [$clientId];
if ($status !== null) {
    $sql .= ' AND s.status = ?';
    $params[] = $status;
}
if ($scopedEntity !== null) {
    $sql .= ' AND s.entity = ?';
    $params[] = $scopedEntity;
}
$sql .= ' ORDER BY s.created_at DESC';

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$submissions = $stmt->fetchAll();

$filesStmt = $pdo->prepare('SELECT original_name, drive_file_id, drive_file_link, kind FROM submission_files WHERE submission_id = ?');

$result = array_map(function ($s) use ($filesStmt) {
    $filesStmt->execute([$s['id']]);
    return [
        'id' => (int) $s['id'],
        'entity' => $s['entity'],
        'version' => $s['version'],
        'datasetId' => $s['dataset_id'],
        'datasetName' => $s['dataset_name'],
        'tag' => $s['tag'],
        'year' => $s['year'],
        'unit' => $s['unit'],
        'notes' => $s['notes'],
        'status' => $s['status'],
        'submittedBy' => $s['submitted_by'],
        'date' => substr($s['created_at'], 0, 10),
        'reviewedBy' => $s['reviewed_by'],
        'reviewedAt' => $s['reviewed_at'],
        'rejectionReason' => $s['rejection_reason'],
        'files' => $filesStmt->fetchAll(),
    ];
}, $submissions);

dolphin_send_json($result);
