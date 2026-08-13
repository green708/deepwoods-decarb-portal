<?php
// priority-items.php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth_middleware.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$user      = dolphin_require_auth();
dolphin_require_active_client($user);
dolphin_require_payment($user);
$client_id = (int)$user['client_id'];

$entity = dolphin_validate_entity($user, trim($_GET['entity'] ?? '')) ?: null;
$params = [$client_id];
$sql = "SELECT id, item_type AS type, entity, title, detail, priority, link, age, tag
        FROM priority_items WHERE client_id = ?";
if ($entity) { $sql .= " AND entity = ?"; $params[] = $entity; }
$sql .= " ORDER BY priority DESC, id";
$stmt = $pdo->prepare($sql);
$stmt->execute($params);
echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
