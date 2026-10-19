<?php
// data-gaps.php — Deepwoods-only endpoint.
// GET ?client_id=X&fy=FY25[&scope=Scope+1]
// Returns per-asset, per-month data completeness for a client × FY.
//
// Response:
// {
//   "months": ["APR-24","MAY-24",...],   // 12 months in FY order
//   "assets": [
//     {
//       "asset_id": "...", "name": "...", "scope": "Scope 1",
//       "sub_type": "...", "entity": "...", "facility": "...",
//       "months": { "APR-24": true, "MAY-24": false, ... },
//       "filled": 8, "total": 12, "pct": 67
//     }, ...
//   ],
//   "summary": { "total_points": N, "filled": N, "gaps": N, "pct": N }
// }

declare(strict_types=1);
require_once __DIR__ . '/db.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Allow-Methods: GET, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$user = dolphin_require_auth();
if (!in_array($user['role'] ?? '', ['deepwoods_admin', 'deepwoods_coordinator', 'sustainability_team'], true)) {
    dolphin_send_json(['error' => 'Insufficient permissions'], 403);
}

$pdo = dolphin_db();

// --- Resolve client ---
$isDW     = in_array($user['role'], ['deepwoods_admin', 'deepwoods_coordinator'], true);
$clientId = $isDW ? (int)($_GET['client_id'] ?? 0) : (int)($user['client_id'] ?? 0);
$fy       = trim($_GET['fy'] ?? '');
$scopeFilter = trim($_GET['scope'] ?? '');   // optional: "Scope 1", "Scope 2", "Scope 3"

if (!$clientId) { dolphin_send_json(['error' => 'client_id required'], 400); }
if (!$fy)       { dolphin_send_json(['error' => 'fy required'], 400); }

// Verify client exists
$cc = $pdo->prepare('SELECT id, reporting_period FROM clients WHERE id = ?');
$cc->execute([$clientId]);
$clientRow = $cc->fetch();
if (!$clientRow) { dolphin_send_json(['error' => 'client not found'], 404); }

// --- Build 12-month array for this FY ---
// FY25 = Apr 2024 – Mar 2025 (start month 4, year offset -1 for Apr–Dec)
// CY25 = Jan 2025 – Dec 2025 (start month 1)
$fyNum      = (int)preg_replace('/\D/', '', $fy);   // 25 or 2025
$fyFull     = $fyNum < 100 ? 2000 + $fyNum : $fyNum; // 2025
$reportingP = $clientRow['reporting_period'] ?? 'FY';

// Get fiscal_year_start_month from client_config (default 4 = April for FY)
$cfgStmt = $pdo->prepare("SELECT config_value FROM client_config WHERE client_id = ? AND config_key = 'fiscal_year_start_month'");
$cfgStmt->execute([$clientId]);
$startMonth = $reportingP === 'CY' ? 1 : (int)(($cfgStmt->fetchColumn()) ?: 4);

$ALL_MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
$startIdx   = $startMonth - 1;
$ordered    = array_merge(array_slice($ALL_MONTHS, $startIdx), array_slice($ALL_MONTHS, 0, $startIdx));

// Build month keys like "APR-24"
$months = [];
foreach ($ordered as $i => $m) {
    $monthIdx = ($startIdx + $i) % 12;
    if ($reportingP === 'CY') {
        $calYear = $fyFull;
    } else {
        // Months from startMonth to Dec belong to year $fyFull - 1
        // Months Jan to startMonth-1 belong to $fyFull
        $calYear = $monthIdx >= $startIdx ? $fyFull - 1 : $fyFull;
    }
    $yy2 = substr((string)$calYear, -2);
    $months[] = "{$m}-{$yy2}";
}

// --- Fetch all assets for this client ---
$assetSql = "SELECT asset_id, name, scope, sub_type, entity, facility, active_from_fy
             FROM decarb_assets
             WHERE client_id = ? AND status = 'Active'";
$params = [$clientId];
if ($scopeFilter) {
    $assetSql .= " AND scope = ?";
    $params[] = $scopeFilter;
}
$assetSql .= " ORDER BY scope, entity, facility, name";
$astmt = $pdo->prepare($assetSql);
$astmt->execute($params);
$assets = $astmt->fetchAll(PDO::FETCH_ASSOC);

// --- Fetch all tracker_drafts for this client × FY in one query ---
// period format: "APR-24__lb", "APR-24__mb", or just "APR-24" (simple)
// For the gaps check we consider a month filled if ANY period starting with
// the month key has a non-null value.
$draftStmt = $pdo->prepare(
    "SELECT asset_id, period, value
     FROM tracker_drafts
     WHERE client_id = ? AND fiscal_year = ?"
);
$draftStmt->execute([$clientId, $fy]);
$drafts = $draftStmt->fetchAll(PDO::FETCH_ASSOC);

// Build a set: asset_id → set of month keys that have data
$hasData = [];   // [asset_id][month_key] = true
foreach ($drafts as $d) {
    if ($d['value'] === null || $d['value'] === '') continue;
    $aid    = $d['asset_id'];
    $period = $d['period'];
    // Extract the month key: first 6 chars like "APR-24"
    $mk = strtoupper(substr($period, 0, 6));
    if (!isset($hasData[$aid])) $hasData[$aid] = [];
    $hasData[$aid][$mk] = true;
}

// --- Build response ---
$totalPoints = 0;
$totalFilled = 0;
$result = [];

foreach ($assets as $a) {
    $aid = $a['asset_id'];

    // Skip assets that weren't active in this FY
    if (!empty($a['active_from_fy']) && $a['active_from_fy'] > $fy) continue;

    // Fugitive/annual assets — only 1 expected data point (annual)
    $subType = strtolower($a['sub_type'] ?? '');
    $isAnnual = in_array($subType, ['fugitive', 'refrigerant', 'fire-extinguisher'], true)
             || str_contains($subType, 'refrigerant')
             || str_contains($subType, 'fire ext');

    $monthMap = [];
    $filled   = 0;

    if ($isAnnual) {
        // Annual: just check if any draft row exists at all for this asset × FY
        $anyData = !empty($hasData[$aid]);
        $monthMap['Annual'] = $anyData;
        if ($anyData) $filled++;
        $total = 1;
    } else {
        foreach ($months as $mk) {
            $has = !empty($hasData[$aid][$mk]);
            $monthMap[$mk] = $has;
            if ($has) $filled++;
        }
        $total = 12;
    }

    $totalPoints += $total;
    $totalFilled += $filled;

    $result[] = [
        'asset_id' => $aid,
        'name'     => $a['name'],
        'scope'    => $a['scope'],
        'sub_type' => $a['sub_type'],
        'entity'   => $a['entity'],
        'facility' => $a['facility'] ?? '',
        'months'   => $monthMap,
        'filled'   => $filled,
        'total'    => $total,
        'pct'      => $total > 0 ? (int)round($filled / $total * 100) : 0,
    ];
}

$gaps = $totalPoints - $totalFilled;

dolphin_send_json([
    'months'  => $months,
    'assets'  => $result,
    'summary' => [
        'total_points' => $totalPoints,
        'filled'       => $totalFilled,
        'gaps'         => $gaps,
        'pct'          => $totalPoints > 0 ? (int)round($totalFilled / $totalPoints * 100) : 0,
    ],
    'fy'        => $fy,
    'client_id' => $clientId,
]);
