<?php
// data-tracker/export.php
// Admin-only: download tracker data as CSV.
// GET ?client_id=3&entity=FP&fy=FY26
// Returns: Content-Disposition: attachment; filename="tracker_...csv"
// Columns: Asset ID, Asset Name, Facility, Scope, Sub-type, Unit, Period, Value

declare(strict_types=1);
require_once __DIR__ . '/../db.php';

$user = dolphin_require_auth();
$role = $user['role'] ?? '';
if (!in_array($role, ['deepwoods_admin', 'deepwoods_coordinator'], true)) {
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Admin access required']);
    http_response_code(403);
    exit;
}

$clientId = (int)($_GET['client_id'] ?? 0);
$entity   = trim($_GET['entity'] ?? '');
$fy       = trim($_GET['fy']     ?? '');

if (!$clientId || !$entity || !$fy) {
    header('Content-Type: application/json');
    echo json_encode(['error' => 'client_id, entity, and fy required']);
    http_response_code(400);
    exit;
}

$pdo = dolphin_db();

// Fetch all draft rows joined with asset metadata
$stmt = $pdo->prepare(
    'SELECT
         d.asset_id,
         a.name        AS asset_name,
         a.facility    AS facility,
         a.scope       AS scope,
         a.sub_type    AS sub_type,
         a.unit        AS unit,
         d.period,
         d.value,
         d.updated_at
     FROM tracker_drafts d
     LEFT JOIN decarb_assets a
         ON a.client_id = d.client_id AND a.asset_id = d.asset_id
     WHERE d.client_id = ? AND d.entity = ? AND d.fiscal_year = ?
     ORDER BY d.asset_id, d.period'
);
$stmt->execute([$clientId, $entity, $fy]);
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

$filename = "tracker_{$entity}_{$fy}_" . date('Ymd') . ".csv";

header('Content-Type: text/csv; charset=utf-8');
header("Content-Disposition: attachment; filename=\"{$filename}\"");
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization');

$out = fopen('php://output', 'w');

// BOM for Excel UTF-8 compatibility
fwrite($out, "\xEF\xBB\xBF");

fputcsv($out, ['Asset ID', 'Asset Name', 'Facility', 'Scope', 'Sub-type', 'Unit', 'Period', 'Value', 'Last Updated']);

foreach ($rows as $r) {
    fputcsv($out, [
        $r['asset_id']   ?? '',
        $r['asset_name'] ?? '',
        $r['facility']   ?? '',
        $r['scope']      ?? '',
        $r['sub_type']   ?? '',
        $r['unit']       ?? '',
        $r['period']     ?? '',
        $r['value']      ?? '',
        $r['updated_at'] ?? '',
    ]);
}

fclose($out);
exit;
