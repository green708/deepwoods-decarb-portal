<?php
// credits/irec.php — GET /backend/api/credits/irec.php[?entity=FP]

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
$entity    = dolphin_validate_entity($user, trim($_GET['entity'] ?? ''));

// Determine the consolidated entity code for this client (DB-driven, not hardcoded)
$consStmt = $pdo->prepare('SELECT code FROM client_entities WHERE client_id = ? AND is_consolidated = 1 LIMIT 1');
$consStmt->execute([$client_id]);
$consolidatedCode = $consStmt->fetchColumn() ?: null;

$sql = "SELECT entity, facility, mwh, coverage, vintage, instrument, status, year AS fy
        FROM irec_register WHERE client_id = ?";
$params = [$client_id];
// Filter by entity only if it's not the consolidated entity (which represents all)
if ($entity && (!$consolidatedCode || $entity !== $consolidatedCode)) {
    $sql .= " AND entity = ?"; $params[] = $entity;
}
$sql .= " ORDER BY year DESC, entity";

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
foreach ($rows as &$r) { $r['mwh'] = (float)$r['mwh']; }
echo json_encode($rows);
