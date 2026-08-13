<?php
declare(strict_types=1);
require __DIR__ . '/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    dolphin_send_json(['error' => 'POST only'], 405);
}

$authUser = dolphin_require_auth();
if ($authUser['role'] !== 'deepwoods_admin') {
    dolphin_send_json(['error' => 'Admin only'], 403);
}

$body = dolphin_json_body();
$submissionId = (int) ($body['submissionId'] ?? 0);
$action = $body['action'] ?? ''; // 'Approved' | 'Rejected' | 'Reassigned'
$actor = $authUser['email']; // from the session, not client-supplied
$notes = $body['notes'] ?? null;

if ($submissionId <= 0 || !in_array($action, ['Approved', 'Rejected', 'Reassigned'], true)) {
    dolphin_send_json(['error' => 'submissionId and a valid action are required'], 400);
}

$pdo = dolphin_db();

// Verify the submission exists before acting. deepwoods_admin has cross-client
// authority by design, but we must not write audit log rows for ghost IDs.
$check = $pdo->prepare('SELECT id FROM submissions WHERE id = ?');
$check->execute([$submissionId]);
if (!$check->fetch()) {
    dolphin_send_json(['error' => 'Submission not found'], 404);
}

// Reassigned doesn't change status — it's logged as an action but the
// submission stays Pending until an actual Approve/Reject happens.
if ($action !== 'Reassigned') {
    $stmt = $pdo->prepare(
        'UPDATE submissions SET status = ?, reviewed_by = ?, reviewed_at = NOW(), rejection_reason = ? WHERE id = ?'
    );
    $stmt->execute([$action, $actor, $action === 'Rejected' ? $notes : null, $submissionId]);
}

$log = $pdo->prepare('INSERT INTO audit_log (submission_id, action, actor, notes) VALUES (?, ?, ?, ?)');
$log->execute([$submissionId, $action, $actor, $notes]);

dolphin_send_json(['ok' => true, 'submissionId' => $submissionId, 'action' => $action]);
