<?php
// ghg/facilities.php — GET /backend/api/ghg/facilities.php[?entity=FP]

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_middleware.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$user      = requireAuth();
$client_id = (int)$user['client_id'];
$entity    = $_GET['entity'] ?? null;
// Enforce entity_scope — scoped users cannot query other entities
if (!empty($user['entity_scope'])) { $entity = $user['entity_scope']; }

$sql = "SELECT id, entity, name, location, state, grid_utility, re_instrument
        FROM ghg_facilities WHERE client_id = ?";
$params = [$client_id];
if ($entity) { $sql .= " AND entity = ?"; $params[] = $entity; }
$sql .= " ORDER BY entity, name";

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
