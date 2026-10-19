<?php
// admin/activity.php — GET. Staff activity trail, newest first; optionally for one client.

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

$limit = (int)($_GET['limit'] ?? 50);
$limit = $limit < 1 ? 50 : min($limit, 200);

$sql = 'SELECT a.id, a.client_id, c.name AS client_name, a.actor, a.action, a.detail, a.created_at
        FROM admin_activity a LEFT JOIN clients c ON c.id = a.client_id';
$params = [];
if (isset($_GET['client_id']) && $_GET['client_id'] !== '') {
    $cid = (int)$_GET['client_id'];
    if ($cid <= 0) dolphin_send_json(['error' => 'Invalid client_id'], 400);
    $sql .= ' WHERE a.client_id = ?';
    $params[] = $cid;
}
$sql .= ' ORDER BY a.created_at DESC, a.id DESC LIMIT ?';

$st = $pdo->prepare($sql);
$i = 1;
foreach ($params as $v) $st->bindValue($i++, $v, PDO::PARAM_INT);
$st->bindValue($i, $limit, PDO::PARAM_INT);
$st->execute();

$rows = [];
foreach ($st->fetchAll() as $r) {
    $rows[] = [
        'id'          => (int)$r['id'],
        'client_id'   => $r['client_id'] === null ? null : (int)$r['client_id'],
        'client_name' => $r['client_name'],
        'actor'       => $r['actor'],
        'action'      => $r['action'],
        'detail'      => $r['detail'],
        'created_at'  => dolphin_iso($r['created_at']),
    ];
}
dolphin_send_json(['activity' => $rows]);
