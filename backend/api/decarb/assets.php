<?php
// decarb/assets.php — GET /backend/api/decarb/assets.php[?entity=FP]

require_once __DIR__ . '/../db.php';

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

$fy = trim($_GET['fy'] ?? '');

$sql = "SELECT a.asset_id AS id, a.entity, a.name, TRIM(a.facility) AS facility, a.fuel_type AS fuel,
               a.scope, a.sub_type, a.status, a.health, a.unit
        FROM decarb_assets a WHERE a.client_id = ?
          AND (a.status IS NULL OR LOWER(a.status) != 'inactive')";
$params = [$client_id];
if ($entity && (!$consolidatedCode || $entity !== $consolidatedCode)) {
    $sql .= " AND a.entity = ?"; $params[] = $entity;
}
// Year-range filter: only show assets active in the requested FY
// Requires active_from_fy and active_through_fy columns on decarb_assets (run migration SQL to add them)
if ($fy) {
    $sql .= " AND (a.active_from_fy IS NULL OR a.active_from_fy <= ?)";
    $params[] = $fy;
    $sql .= " AND (a.active_through_fy IS NULL OR a.active_through_fy >= ?)";
    $params[] = $fy;
}

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$assets = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Fetch series data for each asset
$ids = array_column($assets, 'id');
$series = [];
if ($ids) {
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $stmt2 = $pdo->prepare(
        "SELECT asset_id, year, tco2e FROM s1_equipment WHERE client_id = ? AND asset_id IN ($placeholders) ORDER BY year"
    );
    $stmt2->execute(array_merge([$client_id], $ids));
    foreach ($stmt2->fetchAll(PDO::FETCH_ASSOC) as $row) {
        // Store historical tCO2e by year (used by trend charts), but never pre-fill
        // the 'annual' key — that key is raw input data (kg, litres) from tracker_drafts,
        // not a calculated emission value.
        $series[$row['asset_id']][$row['year']] = (float)$row['tco2e'];
    }

    // Merge monthly tracker_drafts when fy is provided
    if ($fy) {
        $draftSql = "SELECT asset_id, period, value FROM tracker_drafts
                     WHERE client_id = ? AND fiscal_year = ? AND asset_id IN ($placeholders)";
        $draftParams = array_merge([$client_id, $fy], $ids);
        if ($entity && (!$consolidatedCode || $entity !== $consolidatedCode)) {
            $draftSql .= " AND entity = ?";
            $draftParams[] = $entity;
        }
        $stmt3 = $pdo->prepare($draftSql);
        $stmt3->execute($draftParams);
        foreach ($stmt3->fetchAll(PDO::FETCH_ASSOC) as $row) {
            if ($row['value'] !== null) {
                $series[$row['asset_id']][$row['period']] = (float)$row['value'];
            }
        }
    }
}
foreach ($assets as &$a) {
    $a['series'] = $series[$a['id']] ?? [];
}

echo json_encode($assets);
