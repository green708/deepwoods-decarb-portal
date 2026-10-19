<?php
// admin/inbox.php — GET. Cross-client data-query threads (ndc_threads) that need a Deepwoods reply.
//
// Threads are filtered, ordered and paged first; only the visible page then looks up its last message
// and message count, so the cost is bounded by per_page rather than by the total number of messages.

declare(strict_types=1);
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../lib_admin.php';
require_once __DIR__ . '/../lib_portal.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Headers: Content-Type, X-Api-Key, Authorization');
header('Access-Control-Allow-Methods: GET, OPTIONS');

$user = dolphin_require_auth();
dolphin_require_deepwoods($user);
dolphin_require_method(['GET']);
$pdo = dolphin_db();

$status = (string)($_GET['status'] ?? 'open');
if (!in_array($status, ['open', 'all'], true)) dolphin_send_json(['error' => 'status must be open or all'], 400);
$page    = max(1, (int)($_GET['page'] ?? 1));
$perPage = (int)($_GET['per_page'] ?? 25);
$perPage = $perPage < 1 ? 25 : min($perPage, 100);

$where = []; $params = [];
if ($status === 'open') $where[] = "t.last_from_role = 'client'";
if (isset($_GET['client_id']) && $_GET['client_id'] !== '') {
    $cid = (int)$_GET['client_id'];
    if ($cid <= 0) dolphin_send_json(['error' => 'Invalid client_id'], 400);
    $where[] = 't.client_id = ?';
    $params[] = $cid;
}
$whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';

$st = $pdo->prepare("SELECT COUNT(*) FROM ndc_threads t JOIN clients c ON c.id = t.client_id $whereSql");
$st->execute($params);
$total = (int)$st->fetchColumn();

$sql = "SELECT p.id AS thread_id, p.client_id, p.client_name, p.source_type, p.source_id, p.fy, p.last_from_role,
               lm.created_at AS waiting_since, lm.author AS last_author, LEFT(lm.message, 160) AS preview,
               TIMESTAMPDIFF(DAY, lm.created_at, NOW()) AS age_days,
               (SELECT COUNT(*) FROM ndc_thread_messages mc WHERE mc.thread_id = p.id) AS message_count
        FROM (SELECT t.id, t.client_id, c.name AS client_name, t.source_type, t.source_id, t.fy, t.last_from_role
              FROM ndc_threads t JOIN clients c ON c.id = t.client_id
              $whereSql
              ORDER BY t.updated_at ASC, t.id ASC
              LIMIT ? OFFSET ?) p
        JOIN ndc_thread_messages lm
          ON lm.id = (SELECT MAX(m.id) FROM ndc_thread_messages m WHERE m.thread_id = p.id)
        ORDER BY lm.created_at ASC, p.id ASC";
$st = $pdo->prepare($sql);
$i = 1;
foreach ($params as $v) $st->bindValue($i++, $v, PDO::PARAM_INT);
$st->bindValue($i++, $perPage, PDO::PARAM_INT);
$st->bindValue($i, ($page - 1) * $perPage, PDO::PARAM_INT);
$st->execute();

$threads = [];
foreach ($st->fetchAll() as $r) {
    $threads[] = [
        'thread_id'      => (int)$r['thread_id'],
        'client_id'      => (int)$r['client_id'],
        'client_name'    => $r['client_name'],
        'source_type'    => $r['source_type'],
        'source_id'      => $r['source_id'],
        'fy'             => $r['fy'],
        'last_from_role' => $r['last_from_role'],
        'waiting_since'  => dolphin_iso($r['waiting_since']),
        'age_days'       => max(0, (int)$r['age_days']),
        'preview'        => $r['preview'],
        'last_author'    => $r['last_author'],
        'message_count'  => (int)$r['message_count'],
    ];
}
dolphin_send_json(['total' => $total, 'page' => $page, 'per_page' => $perPage, 'threads' => $threads]);
