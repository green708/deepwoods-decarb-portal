<?php
// decarb/actions.php — GET /backend/api/decarb/actions.php[?entity=FP]

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_middleware.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$user      = dolphin_require_auth();
dolphin_require_active_client($user);
dolphin_require_payment($user);
$client_id = (int)$user['client_id'];
$entity    = dolphin_validate_entity($user, trim($_GET['entity'] ?? '')) ?: null;

// Look up consolidated entity code (replaces hardcoded 'FL')
$consStmt = $pdo->prepare('SELECT code FROM client_entities WHERE client_id = ? AND is_consolidated = 1 LIMIT 1');
$consStmt->execute([$client_id]);
$consolidatedCode = $consStmt->fetchColumn() ?: null;

$sql = "SELECT id, entity, title, description, facilities, lever,
               status, priority, abatement_t, timeline,
               owner, start_date, end_date, cost, actual_abatement_t
        FROM decarb_actions WHERE client_id = ?";
$params = [$client_id];
if ($entity && (!$consolidatedCode || $entity !== $consolidatedCode)) {
    $sql .= " AND (entity = ? OR entity = 'All')";
    $params[] = $entity;
}
$sql .= " ORDER BY FIELD(priority, 'High', 'Medium', 'Low'), id";

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

foreach ($rows as &$row) {
    $row['facilities']  = $row['facilities'] ? json_decode($row['facilities'], true) : [];
    $row['abatement_t'] = $row['abatement_t'] !== null ? (float)$row['abatement_t'] : null;
    $row['actual_abatement_t'] = $row['actual_abatement_t'] !== null ? (float)$row['actual_abatement_t'] : null;
    $row['cost'] = $row['cost'] !== null ? (float)$row['cost'] : null;
}

echo json_encode($rows);
