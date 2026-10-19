<?php
// data-health.php — GET /backend/api/data-health.php
// Returns a list of data-quality checks across all clients (admin only).
// Each check has: id, label, client_id, client_name, severity, status, detail, fix_hint

declare(strict_types=1);
require_once __DIR__ . '/db.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$user = dolphin_require_auth();
$deepwoodsRoles = ['deepwoods_admin', 'deepwoods_coordinator'];
if (!in_array($user['role'], $deepwoodsRoles, true)) {
    dolphin_send_json(['error' => 'Not authorised'], 403);
}

$pdo = dolphin_db();

// ── Build a client_id → name map ───────────────────────────────────────────
$clientMap = [];
foreach ($pdo->query("SELECT id, name FROM clients WHERE is_active = 1")->fetchAll(PDO::FETCH_ASSOC) as $c) {
    $clientMap[(int)$c['id']] = $c['name'];
}

$checks = [];

// ── CHECK 1: Assets with unit='tCO2e' for non-emission sub_types ──────────
$stmt = $pdo->prepare(
    "SELECT client_id, COUNT(*) AS cnt
     FROM decarb_assets
     WHERE unit = 'tCO2e'
       AND sub_type IN ('stationary','mobile','fire-extinguisher','fugitive',
                        'electricity','diesel-generator-electricity','solar','wind')
     GROUP BY client_id"
);
$stmt->execute();
foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
    $cid = (int)$row['client_id'];
    $cnt = (int)$row['cnt'];
    $checks[] = [
        'id'          => "unit-tco2e-c{$cid}",
        'check'       => 'Asset activity units',
        'client_id'   => $cid,
        'client_name' => $clientMap[$cid] ?? "Client #{$cid}",
        'severity'    => 'high',
        'status'      => $cnt > 0 ? 'open' : 'ok',
        'detail'      => $cnt > 0
            ? "{$cnt} asset(s) still have unit='tCO2e' instead of L/kg/kWh"
            : 'All assets have correct activity units',
        'fix'         => 'Run fix_data_gaps_2026-09-05.sql Issue 6 block',
        'count'       => $cnt,
    ];
}

// ── CHECK 2: Scope 2 electricity assets missing MB monthly data ────────────
// Find asset × year combos that have __lb rows but no __mb rows
$stmt = $pdo->query(
    "SELECT lb.client_id, COUNT(DISTINCT CONCAT(lb.entity,'|',lb.fiscal_year,'|',lb.asset_id)) AS cnt
     FROM tracker_drafts lb
     JOIN decarb_assets da
          ON da.client_id = lb.client_id
         AND da.asset_id  = lb.asset_id
         AND da.sub_type  = 'electricity'
     WHERE lb.period LIKE '%__lb'
       AND NOT EXISTS (
           SELECT 1 FROM tracker_drafts mb
           WHERE mb.client_id   = lb.client_id
             AND mb.entity      = lb.entity
             AND mb.fiscal_year = lb.fiscal_year
             AND mb.asset_id    = lb.asset_id
             AND mb.period      = REPLACE(lb.period, '__lb', '__mb')
       )
     GROUP BY lb.client_id"
);
foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
    $cid = (int)$row['client_id'];
    $cnt = (int)$row['cnt'];
    $checks[] = [
        'id'          => "missing-mb-c{$cid}",
        'check'       => 'Scope 2 Market-Based monthly data',
        'client_id'   => $cid,
        'client_name' => $clientMap[$cid] ?? "Client #{$cid}",
        'severity'    => 'high',
        'status'      => $cnt > 0 ? 'open' : 'ok',
        'detail'      => $cnt > 0
            ? "{$cnt} source×year combo(s) have LB rows but no corresponding MB rows"
            : 'All S2 sources have matching MB rows',
        'fix'         => 'Run fix_data_gaps_2026-09-05.sql Issue 4 block',
        'count'       => $cnt,
    ];
}

// ── CHECK 3: DG-elec assets with no active_from_fy restriction ────────────
$stmt = $pdo->prepare(
    "SELECT client_id, COUNT(*) AS cnt
     FROM decarb_assets
     WHERE sub_type = 'diesel-generator-electricity'
       AND active_from_fy IS NULL
     GROUP BY client_id"
);
$stmt->execute();
foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
    $cid = (int)$row['client_id'];
    $cnt = (int)$row['cnt'];
    $checks[] = [
        'id'          => "dgelec-nofrom-c{$cid}",
        'check'       => 'DG-sourced electricity active_from_fy',
        'client_id'   => $cid,
        'client_name' => $clientMap[$cid] ?? "Client #{$cid}",
        'severity'    => 'medium',
        'status'      => $cnt > 0 ? 'open' : 'ok',
        'detail'      => $cnt > 0
            ? "{$cnt} DG-elec asset(s) have no active_from_fy — will appear in all years"
            : 'All DG-elec assets have active_from_fy set',
        'fix'         => 'Run fix_data_gaps_2026-09-05.sql Issues 1 & 5 block',
        'count'       => $cnt,
    ];
}

// ── CHECK 4: reporting_years gaps — clients with inv data but missing FY ───
// Find clients where inv_scope1_assets has years not present in ghg_inventory
$stmt = $pdo->query(
    "SELECT s.client_id,
            GROUP_CONCAT(DISTINCT s.fiscal_year ORDER BY s.fiscal_year) AS inv_years,
            GROUP_CONCAT(DISTINCT g.year         ORDER BY g.year)        AS ghg_years
     FROM inv_scope1_assets s
     LEFT JOIN ghg_inventory g
            ON g.client_id = s.client_id AND g.year = s.fiscal_year
     GROUP BY s.client_id
     HAVING inv_years != COALESCE(ghg_years,'')"
);
foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
    $cid = (int)$row['client_id'];
    $invYears = explode(',', $row['inv_years'] ?? '');
    $ghgYears = array_filter(explode(',', $row['ghg_years'] ?? ''));
    $missing  = array_values(array_diff($invYears, $ghgYears));
    if (empty($missing)) continue;
    $checks[] = [
        'id'          => "missing-fy-c{$cid}",
        'check'       => 'Reporting years in dropdown',
        'client_id'   => $cid,
        'client_name' => $clientMap[$cid] ?? "Client #{$cid}",
        'severity'    => 'high',
        'status'      => 'open',
        'detail'      => implode(', ', $missing) . ' exist in submissions but not in ghg_inventory aggregate — dropdown may be missing them',
        'fix'         => 'Run fix_data_gaps_2026-09-05.sql Issue 7 block (config fallback) OR recompute GHG rollups for those years',
        'count'       => count($missing),
    ];
}

// ── CHECK 5: inv_scope1/scope2 facility_id vs ghg_facilities mismatch ──────
// Find per-year rows where facility_id doesn't match any ghg_facilities.id for that client
$stmt = $pdo->query(
    "SELECT s.client_id, COUNT(*) AS cnt
     FROM inv_scope1_assets s
     WHERE s.facility_id IS NOT NULL
       AND s.facility_id != ''
       AND NOT EXISTS (
           SELECT 1 FROM ghg_facilities f
           WHERE f.client_id = s.client_id
             AND f.id = CAST(s.facility_id AS UNSIGNED)
       )
     GROUP BY s.client_id"
);
foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
    $cid = (int)$row['client_id'];
    $cnt = (int)$row['cnt'];
    $checks[] = [
        'id'          => "facility-mismatch-s1-c{$cid}",
        'check'       => 'Scope 1 facility_id integrity',
        'client_id'   => $cid,
        'client_name' => $clientMap[$cid] ?? "Client #{$cid}",
        'severity'    => 'high',
        'status'      => $cnt > 0 ? 'open' : 'ok',
        'detail'      => $cnt > 0
            ? "{$cnt} Scope 1 submission row(s) reference a facility_id not in ghg_facilities"
            : 'All Scope 1 facility IDs match ghg_facilities',
        'fix'         => 'Run fix_data_gaps_2026-09-05.sql Issues 2 & 3 block',
        'count'       => $cnt,
    ];
}

$stmt = $pdo->query(
    "SELECT s.client_id, COUNT(*) AS cnt
     FROM inv_scope2_sources s
     WHERE s.facility_id IS NOT NULL
       AND s.facility_id != ''
       AND NOT EXISTS (
           SELECT 1 FROM ghg_facilities f
           WHERE f.client_id = s.client_id
             AND f.id = CAST(s.facility_id AS UNSIGNED)
       )
     GROUP BY s.client_id"
);
foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
    $cid = (int)$row['client_id'];
    $cnt = (int)$row['cnt'];
    $checks[] = [
        'id'          => "facility-mismatch-s2-c{$cid}",
        'check'       => 'Scope 2 facility_id integrity',
        'client_id'   => $cid,
        'client_name' => $clientMap[$cid] ?? "Client #{$cid}",
        'severity'    => 'high',
        'status'      => $cnt > 0 ? 'open' : 'ok',
        'detail'      => $cnt > 0
            ? "{$cnt} Scope 2 submission row(s) reference a facility_id not in ghg_facilities"
            : 'All Scope 2 facility IDs match ghg_facilities',
        'fix'         => 'Run fix_data_gaps_2026-09-05.sql Issues 2 & 3 block',
        'count'       => $cnt,
    ];
}

// ── CHECK 6: Scope 2 sources (grid elec) that have no tracker_drafts data at all ──
$stmt = $pdo->query(
    "SELECT da.client_id, COUNT(DISTINCT da.asset_id) AS cnt
     FROM decarb_assets da
     WHERE da.sub_type = 'electricity'
       AND NOT EXISTS (
           SELECT 1 FROM tracker_drafts td
           WHERE td.client_id = da.client_id
             AND td.asset_id  = da.asset_id
       )
     GROUP BY da.client_id"
);
foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
    $cid = (int)$row['client_id'];
    $cnt = (int)$row['cnt'];
    if ($cnt === 0) continue;
    $checks[] = [
        'id'          => "no-s2-data-c{$cid}",
        'check'       => 'Scope 2 sources with no data',
        'client_id'   => $cid,
        'client_name' => $clientMap[$cid] ?? "Client #{$cid}",
        'severity'    => 'medium',
        'status'      => 'open',
        'detail'      => "{$cnt} electricity source(s) registered but have zero tracker_drafts entries",
        'fix'         => 'Data collection needed — submit monthly data for these sources',
        'count'       => $cnt,
    ];
}

// ── Summary counts ─────────────────────────────────────────────────────────
$openHigh   = count(array_filter($checks, fn($c) => $c['status'] === 'open' && $c['severity'] === 'high'));
$openMedium = count(array_filter($checks, fn($c) => $c['status'] === 'open' && $c['severity'] === 'medium'));
$resolved   = count(array_filter($checks, fn($c) => $c['status'] === 'ok'));

dolphin_send_json([
    'summary' => [
        'open_high'   => $openHigh,
        'open_medium' => $openMedium,
        'resolved'    => $resolved,
        'total'       => count($checks),
    ],
    'checks' => $checks,
    'as_of'  => date('c'),
]);
