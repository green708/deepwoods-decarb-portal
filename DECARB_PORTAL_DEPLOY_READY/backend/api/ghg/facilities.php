<?php
// ghg/facilities.php — GET /backend/api/ghg/facilities.php[?entity=FP]

declare(strict_types=1);
require_once __DIR__ . '/../db.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Allow-Methods: GET, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$user      = dolphin_require_auth();
dolphin_require_active_client($user);
dolphin_require_payment($user);
$client_id = (int)($user['client_id'] ?? 0);

if (!$client_id) {
    echo json_encode([]);
    exit;
}

$entity = dolphin_validate_entity($user, trim($_GET['entity'] ?? '')) ?: null;

$pdo = dolphin_db();

$sql = "SELECT id, entity, name, location, state, grid_utility, re_instrument
        FROM ghg_facilities WHERE client_id = ?";
$params = [$client_id];
if ($entity) { $sql .= " AND entity = ?"; $params[] = $entity; }
$sql .= " ORDER BY entity, name";

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
