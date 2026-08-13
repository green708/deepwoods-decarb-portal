<?php
// vault.php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth_middleware.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$user      = dolphin_require_auth();
dolphin_require_active_client($user);
dolphin_require_payment($user);
$client_id = (int)($user['client_id'] ?? 0);

if (!$client_id) { echo json_encode([]); exit; }

$entity = dolphin_validate_entity($user, trim($_GET['entity'] ?? '')) ?: null;
$fy     = $_GET['fy'] ?? null;

$sql = "SELECT id, entity, year AS fy, title, doc_type AS type, drive_link, uploaded_at
        FROM vault_documents WHERE client_id = ?";
$params = [$client_id];
if ($entity) { $sql .= " AND entity = ?"; $params[] = $entity; }
if ($fy)     { $sql .= " AND year = ?";   $params[] = $fy; }
$sql .= " ORDER BY uploaded_at DESC";
$stmt = $pdo->prepare($sql);
$stmt->execute($params);
echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
