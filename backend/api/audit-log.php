<?php
declare(strict_types=1);
require __DIR__ . '/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    dolphin_send_json(['error' => 'GET only'], 405);
}

$authUser = dolphin_require_auth();

$pdo      = dolphin_db();
$clientId = $authUser['client_id'];

$stmt = $pdo->prepare(
    'SELECT a.id, a.submission_id, a.action, a.actor, a.notes, a.created_at,
            s.dataset_name, s.year, s.entity
     FROM audit_log a
     JOIN submissions s ON s.id = a.submission_id
     WHERE s.client_id = ?
     ORDER BY a.created_at DESC'
);
$stmt->execute([$clientId]);

dolphin_send_json($stmt->fetchAll());
