<?php
// inventory-boundary.php
// GET  → load all boundary data (scope1, scope2, opControl) for the client
// POST → save one section: { section: 'scope1'|'scope2'|'opcontrol', data: [...] }
//        On scope1/scope2 save, also syncs to decarb_assets so the data tracker
//        shows the same assets immediately.

declare(strict_types=1);
require_once __DIR__ . '/db.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$user     = dolphin_require_auth();
dolphin_block_read_only_writes($user);
$clientId = (int)($user['client_id'] ?? 0);
if (!$clientId) { dolphin_send_json(['error' => 'User is not associated with a client'], 403); }

$pdo = dolphin_db();

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Generate a stable decarb_assets id scoped to this client.
 * $facilitySlug is the resolved facility name (not the raw facilityId).
 */
function inv_stable_id(int $clientId, string $scope, string $facilitySlug, string $name): string {
    $slug = preg_replace('/[^a-z0-9]+/', '-', strtolower($name));
    $slug = trim($slug, '-');
    $fac  = preg_replace('/[^a-z0-9]+/', '-', strtolower($facilitySlug));
    $fac  = trim($fac, '-');
    $id = "inv-{$scope}-c{$clientId}-{$fac}-{$slug}";
    if (strlen($id) > 100) {
        $id = substr($id, 0, 91) . '-' . substr(hash('crc32b', $id), 0, 8);
    }
    return $id;
}

/**
 * Build facility name lookup for this client.
 * Keys are both the numeric id (string) and the entity code.
 * Falls back to the facilityId itself when not found.
 */
/** @var array<int, array{slug: array<string,string>, entity: array<string,string>}> */
$_inv_fac_cache = [];

function inv_facility_load(PDO $pdo, int $clientId): void {
    global $_inv_fac_cache;
    if (isset($_inv_fac_cache[$clientId])) return;
    $slugMap   = [];
    $entityMap = [];
    try {
        $stmt = $pdo->prepare(
            'SELECT id, entity, name, COALESCE(NULLIF(short_name,""), name) AS slug
             FROM ghg_facilities WHERE client_id = ?'
        );
        $stmt->execute([$clientId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (PDOException $e) {
        $stmt = $pdo->prepare('SELECT id, entity, name, name AS slug FROM ghg_facilities WHERE client_id = ?');
        $stmt->execute([$clientId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    foreach ($rows as $r) {
        $idKey  = (string)$r['id'];
        $entKey = $r['entity'];
        // slug map — keyed by both numeric id and entity code
        $slugMap[$idKey]  = $r['slug'];
        $slugMap[$entKey] = $r['slug'];
        // entity-code map — numeric id → entity code; entity code → entity code
        $entityMap[$idKey]  = $r['entity'];
        $entityMap[$entKey] = $r['entity'];
    }
    $_inv_fac_cache[$clientId] = ['slug' => $slugMap, 'entity' => $entityMap];
}

function inv_facility_slug(PDO $pdo, int $clientId, string $facilityId): string {
    global $_inv_fac_cache;
    inv_facility_load($pdo, $clientId);
    return $_inv_fac_cache[$clientId]['slug'][$facilityId] ?? $facilityId;
}

/** Returns the entity CODE (e.g. "FP") for a given facility ID or entity code. */
function inv_facility_entity(PDO $pdo, int $clientId, string $facilityId): string {
    global $_inv_fac_cache;
    inv_facility_load($pdo, $clientId);
    return $_inv_fac_cache[$clientId]['entity'][$facilityId] ?? $facilityId;
}

function inv_status_label(string $s): string {
    return match($s) {
        'active'             => 'Active',
        'monitor'            => 'Monitor',
        'flagForReplacement' => 'Flag for Replacement',
        'efficient'          => 'Efficient',
        default              => 'Active',
    };
}

/**
 * Upsert one row into decarb_assets.
 * $activeFromFy: the earliest fiscal/calendar year this asset is registered for
 *   (e.g. 'FY25', 'CY2024'). NULL = visible for all years (legacy; avoid).
 * active_through_fy stays NULL (no decommission date set from the boundary page).
 * On conflict we NEVER move active_from_fy earlier — the MIN is set on first
 * insert; subsequent saves only update descriptive columns.
 */
function inv_upsert_asset(PDO $pdo, int $clientId, string $assetId, string $entity,
                           string $name, string $facility, ?string $fuel,
                           string $scope, string $subType, string $status,
                           string $unit, ?string $activeFromFy = null): void {
    $pdo->prepare(
        'INSERT INTO decarb_assets
         (client_id, asset_id, entity, name, facility, fuel_type, scope, sub_type, status, health, unit, active_from_fy)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
             entity         = VALUES(entity),
             name           = VALUES(name),
             facility       = VALUES(facility),
             fuel_type      = VALUES(fuel_type),
             scope          = VALUES(scope),
             sub_type       = VALUES(sub_type),
             status         = VALUES(status),
             unit           = VALUES(unit),
             active_from_fy = COALESCE(
                 LEAST(COALESCE(active_from_fy, VALUES(active_from_fy)), COALESCE(VALUES(active_from_fy), active_from_fy)),
                 active_from_fy,
                 VALUES(active_from_fy)
             )'
    )->execute([$clientId, $assetId, $entity, $name, $facility, $fuel,
                $scope, $subType, $status, 'Efficient', $unit, $activeFromFy]);
}

// ── GET ───────────────────────────────────────────────────────────────────────

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Entity filter: scoped users see only their entity; others can pass ?entity=
    $requestedEntity = trim($_GET['entity'] ?? '');
    $filterEntity    = !empty($user['entity_scope'])
                       ? $user['entity_scope']
                       : ($requestedEntity !== '' ? $requestedEntity : null);

    // Scope 1 — join ghg_facilities so we can filter by entity
    $s1Sql = 'SELECT s.* FROM inv_scope1_assets s
              LEFT JOIN ghg_facilities f ON f.client_id = s.client_id AND f.id = CAST(s.facility_id AS UNSIGNED)
              WHERE s.client_id = ?';
    $s1Params = [$clientId];
    if ($filterEntity !== null) {
        $s1Sql    .= ' AND (f.entity = ? OR (f.id IS NULL AND s.facility_id = ?))';
        $s1Params[] = $filterEntity;
        $s1Params[] = $filterEntity; // fallback: facility_id stored as entity code
    }
    $s1Sql .= ' ORDER BY s.fiscal_year DESC, s.id ASC';
    $s1 = $pdo->prepare($s1Sql);
    $s1->execute($s1Params);
    $scope1 = array_map(fn($r) => [
        'id'                  => $r['client_ref'],
        'fiscalYear'          => $r['fiscal_year'],
        'scope'               => 'scope1',
        'subcategory'         => $r['subcategory'],
        'name'                => $r['name'],
        'facilityId'          => $r['facility_id'],
        'status'              => $r['status'],
        'fuelType'            => $r['fuel_type'],
        'isBiogenic'          => (bool)$r['is_biogenic'],
        'equipmentType'       => $r['equipment_type'],
        'nameplateCapacity'   => ($r['nameplate_capacity_value'] !== null && $r['nameplate_capacity_unit'] !== null)
                                 ? ['value' => (float)$r['nameplate_capacity_value'], 'unit' => $r['nameplate_capacity_unit']]
                                 : null,
        'commissioningDate'   => $r['commissioning_date'],
        'vehicleType'         => $r['vehicle_type'],
        'vehicleCount'        => $r['vehicle_count'] !== null ? (int)$r['vehicle_count'] : null,
        'ownership'           => $r['ownership'],
        'refrigerantOrGas'    => $r['refrigerant_or_gas'],
        'refrigerantChargeKg' => $r['refrigerant_charge_kg'] !== null ? (float)$r['refrigerant_charge_kg'] : null,
        'annualLeakagePct'    => $r['annual_leakage_pct'] !== null ? (float)$r['annual_leakage_pct'] : null,
        'installationDate'    => $r['installation_date'],
    ], $s1->fetchAll());

    // Scope 2 — same entity filter
    $s2Sql = 'SELECT s.* FROM inv_scope2_sources s
              LEFT JOIN ghg_facilities f ON f.client_id = s.client_id AND f.id = CAST(s.facility_id AS UNSIGNED)
              WHERE s.client_id = ?';
    $s2Params = [$clientId];
    if ($filterEntity !== null) {
        $s2Sql    .= ' AND (f.entity = ? OR (f.id IS NULL AND s.facility_id = ?))';
        $s2Params[] = $filterEntity;
        $s2Params[] = $filterEntity;
    }
    $s2Sql .= ' ORDER BY s.fiscal_year DESC, s.id ASC';
    $s2 = $pdo->prepare($s2Sql);
    $s2->execute($s2Params);
    $scope2 = array_map(fn($r) => [
        'id'                   => $r['client_ref'],
        'fiscalYear'           => $r['fiscal_year'],
        'scope'                => 'scope2',
        'category'             => $r['category'],
        'name'                 => $r['name'],
        'facilityId'           => $r['facility_id'],
        'status'               => $r['status'],
        'supplier'             => $r['supplier'],
        'gridConnectionType'   => $r['grid_connection_type'],
        'gridRegion'           => $r['grid_region'],
        'consumerNumber'       => $r['consumer_number'],
        'renewableProcurement' => $r['renewable_procurement'] !== null ? json_decode($r['renewable_procurement'], true) : null,
        'contractType'         => $r['contract_type'],
        'sourceDescription'    => $r['source_description'],
        'isLowCarbon'          => (bool)$r['is_low_carbon'],
    ], $s2->fetchAll());

    // Op control
    $op = $pdo->prepare('SELECT kyoto, scope3 FROM inv_op_control WHERE client_id = ?');
    $op->execute([$clientId]);
    $opRow = $op->fetch();
    $opControl = $opRow
        ? ['kyoto' => json_decode($opRow['kyoto'], true), 'scope3' => json_decode($opRow['scope3'], true)]
        : null;

    dolphin_send_json(['scope1' => $scope1, 'scope2' => $scope2, 'opControl' => $opControl]);
}

// ── POST ──────────────────────────────────────────────────────────────────────

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body    = dolphin_json_body();
    $section = $body['section'] ?? '';
    $data    = $body['data']    ?? null;

    if (!in_array($section, ['scope1', 'scope2', 'opcontrol'], true) || $data === null) {
        dolphin_send_json(['error' => 'Invalid section or missing data'], 400);
    }

    // Entity to scope the save to — sent by the frontend as entityRef.current.
    // Allows multi-entity clients (e.g. Navitas: NLS, NDS, NCR) to save one
    // entity's boundary without wiping the others.
    $saveEntity = trim((string)($body['entity'] ?? ''));

    // Helper: DELETE scope1 rows for the specified entity only (if known),
    // or all rows for the client (legacy / single-entity path).
    function inv_delete_s1(PDO $pdo, int $clientId, string $saveEntity): void {
        if ($saveEntity !== '') {
            $facStmt = $pdo->prepare(
                'SELECT CAST(id AS CHAR) FROM ghg_facilities WHERE client_id = ? AND entity = ?'
            );
            $facStmt->execute([$clientId, $saveEntity]);
            $facIds = $facStmt->fetchAll(PDO::FETCH_COLUMN);
            if ($facIds) {
                $ph = implode(',', array_fill(0, count($facIds), '?'));
                $pdo->prepare("DELETE FROM inv_scope1_assets WHERE client_id = ? AND facility_id IN ($ph)")
                    ->execute(array_merge([$clientId], $facIds));
            }
            // Also cover rows stored with entity code as facility_id
            $pdo->prepare("DELETE FROM inv_scope1_assets WHERE client_id = ? AND facility_id = ?")
                ->execute([$clientId, $saveEntity]);
        } else {
            $pdo->prepare('DELETE FROM inv_scope1_assets WHERE client_id = ?')->execute([$clientId]);
        }
    }

    // Same pattern for Scope 2.
    function inv_delete_s2(PDO $pdo, int $clientId, string $saveEntity): void {
        if ($saveEntity !== '') {
            $facStmt = $pdo->prepare(
                'SELECT CAST(id AS CHAR) FROM ghg_facilities WHERE client_id = ? AND entity = ?'
            );
            $facStmt->execute([$clientId, $saveEntity]);
            $facIds = $facStmt->fetchAll(PDO::FETCH_COLUMN);
            if ($facIds) {
                $ph = implode(',', array_fill(0, count($facIds), '?'));
                $pdo->prepare("DELETE FROM inv_scope2_sources WHERE client_id = ? AND facility_id IN ($ph)")
                    ->execute(array_merge([$clientId], $facIds));
            }
            $pdo->prepare("DELETE FROM inv_scope2_sources WHERE client_id = ? AND facility_id = ?")
                ->execute([$clientId, $saveEntity]);
        } else {
            $pdo->prepare('DELETE FROM inv_scope2_sources WHERE client_id = ?')->execute([$clientId]);
        }
    }

    try {
        $pdo->beginTransaction();

        // ── Scope 1 ────────────────────────────────────────────────────────────

        if ($section === 'scope1') {
            inv_delete_s1($pdo, $clientId, $saveEntity);
            if (is_array($data) && count($data) > 0) {
                $ins = $pdo->prepare(
                    'INSERT INTO inv_scope1_assets
                     (client_id, client_ref, fiscal_year, subcategory, name, facility_id, status,
                      fuel_type, is_biogenic, equipment_type,
                      nameplate_capacity_value, nameplate_capacity_unit, commissioning_date,
                      vehicle_type, vehicle_count, ownership,
                      refrigerant_or_gas, refrigerant_charge_kg, annual_leakage_pct, installation_date)
                     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
                );
                foreach ($data as $a) {
                    $nc = $a['nameplateCapacity'] ?? null;
                    $ins->execute([
                        $clientId,
                        $a['id'],
                        $a['fiscalYear'],
                        $a['subcategory'],
                        $a['name'],
                        $a['facilityId'],
                        $a['status'] ?? 'active',
                        $a['fuelType']           ?? null,
                        !empty($a['isBiogenic']) ? 1 : 0,
                        $a['equipmentType']      ?? null,
                        $nc ? (float)$nc['value'] : null,
                        $nc ? $nc['unit']          : null,
                        $a['commissioningDate']  ?? null,
                        $a['vehicleType']        ?? null,
                        isset($a['vehicleCount'])        ? (int)$a['vehicleCount']        : null,
                        $a['ownership']          ?? null,
                        $a['refrigerantOrGas']   ?? null,
                        isset($a['refrigerantChargeKg']) ? (float)$a['refrigerantChargeKg'] : null,
                        isset($a['annualLeakagePct'])    ? (float)$a['annualLeakagePct']    : null,
                        $a['installationDate']   ?? null,
                    ]);
                }
            }

            // Sync to decarb_assets.
            // Strategy: one row per physical asset (keyed by facility+name).
            // active_from_fy = the EARLIEST year that asset was registered in the boundary,
            // so it only appears in trackers/submissions for the years it actually existed.
            // The upsert never moves active_from_fy forward (LEAST keeps the minimum).
            if ($saveEntity !== '') {
                $pdo->prepare(
                    "DELETE FROM decarb_assets WHERE client_id = ? AND asset_id LIKE 'inv-s1-%' AND entity = ?"
                )->execute([$clientId, $saveEntity]);
            } else {
                $pdo->prepare("DELETE FROM decarb_assets WHERE client_id = ? AND asset_id LIKE 'inv-s1-%'")->execute([$clientId]);
            }

            // Build earliest-FY map (scan ascending so first-seen = earliest)
            $earliestFY = [];
            $sortedAsc  = $data;
            usort($sortedAsc, fn($a, $b) => strcmp($a['fiscalYear'] ?? '', $b['fiscalYear'] ?? ''));
            foreach ($sortedAsc as $a) {
                $key = strtolower(($a['facilityId'] ?? '') . '|' . ($a['name'] ?? ''));
                if (!isset($earliestFY[$key])) $earliestFY[$key] = $a['fiscalYear'] ?? null;
            }

            // Re-sync from newest-first so we get the most-current asset details
            $seen       = [];
            $sortedDesc = $sortedAsc;
            usort($sortedDesc, fn($a, $b) => strcmp($b['fiscalYear'] ?? '', $a['fiscalYear'] ?? ''));
            foreach ($sortedDesc as $a) {
                $key = strtolower(($a['facilityId'] ?? '') . '|' . ($a['name'] ?? ''));
                if (isset($seen[$key])) continue;
                $seen[$key] = true;

                $facilityId = $a['facilityId'] ?? '';
                if (!$facilityId) continue;

                $facSlug    = inv_facility_slug($pdo, $clientId, $facilityId);
                $entityCode = inv_facility_entity($pdo, $clientId, $facilityId);
                $facLabel   = $facSlug;
                $stableId   = inv_stable_id($clientId, 's1', $facSlug, $a['name'] ?? 'asset');
                $subTypeMap = ['stationary' => 'Stationary', 'mobile' => 'Mobile', 'fugitive' => 'Fugitive'];
                $subType    = $subTypeMap[$a['subcategory'] ?? ''] ?? 'Stationary';
                $unit       = match($a['subcategory'] ?? '') {
                    'fugitive'   => 'kg',
                    'mobile'     => 'L',
                    default      => 'L',
                };
                inv_upsert_asset(
                    $pdo, $clientId, $stableId, $entityCode,
                    $a['name'] ?? '', $facLabel, $a['fuelType'] ?? null,
                    'Scope 1', $subType, inv_status_label($a['status'] ?? 'active'), $unit,
                    $earliestFY[$key] ?? null
                );
            }

            // Remove tracker_drafts rows for S1 assets that no longer exist in decarb_assets
            $pdo->prepare(
                "DELETE FROM tracker_drafts WHERE client_id = ? AND asset_id LIKE 'inv-s1-%'
                 AND asset_id NOT IN (SELECT asset_id FROM decarb_assets WHERE client_id = ? AND asset_id LIKE 'inv-s1-%')"
            )->execute([$clientId, $clientId]);
        }

        // ── Scope 2 ────────────────────────────────────────────────────────────

        if ($section === 'scope2') {
            inv_delete_s2($pdo, $clientId, $saveEntity);
            if (is_array($data) && count($data) > 0) {
                $ins = $pdo->prepare(
                    'INSERT INTO inv_scope2_sources
                     (client_id, client_ref, fiscal_year, category, name, facility_id, status,
                      supplier, grid_connection_type, grid_region, consumer_number, renewable_procurement,
                      contract_type, source_description, is_low_carbon)
                     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
                );
                foreach ($data as $s) {
                    $ins->execute([
                        $clientId,
                        $s['id'],
                        $s['fiscalYear'],
                        $s['category'],
                        $s['name'],
                        $s['facilityId'],
                        $s['status']             ?? 'active',
                        $s['supplier']           ?? null,
                        $s['gridConnectionType'] ?? null,
                        $s['gridRegion']         ?? null,
                        $s['consumerNumber']     ?? null,
                        isset($s['renewableProcurement']) ? json_encode($s['renewableProcurement']) : null,
                        $s['contractType']       ?? null,
                        $s['sourceDescription']  ?? null,
                        !empty($s['isLowCarbon']) ? 1 : 0,
                    ]);
                }
            }

            // Sync to decarb_assets — same earliest-FY strategy as Scope 1
            // Only wipe standard procurement sub_types; on-site generation items
            // (solar-generated, solar-consumed, solar-exported, wind, etc.) are
            // seeded separately and must survive a scope-2 boundary resave.
            if ($saveEntity !== '') {
                $pdo->prepare(
                    "DELETE FROM decarb_assets
                     WHERE client_id = ? AND asset_id LIKE 'inv-s2-%' AND entity = ?
                       AND sub_type IN ('Grid Electricity','Purchased Steam','District Heating','District Cooling')"
                )->execute([$clientId, $saveEntity]);
            } else {
                $pdo->prepare(
                    "DELETE FROM decarb_assets
                     WHERE client_id = ? AND asset_id LIKE 'inv-s2-%'
                       AND sub_type IN ('Grid Electricity','Purchased Steam','District Heating','District Cooling')"
                )->execute([$clientId]);
            }

            $earliestFY2 = [];
            $sortedAsc2  = $data;
            usort($sortedAsc2, fn($a, $b) => strcmp($a['fiscalYear'] ?? '', $b['fiscalYear'] ?? ''));
            foreach ($sortedAsc2 as $s) {
                $key = strtolower(($s['facilityId'] ?? '') . '|' . ($s['name'] ?? ''));
                if (!isset($earliestFY2[$key])) $earliestFY2[$key] = $s['fiscalYear'] ?? null;
            }

            $seen2      = [];
            $sortedDesc2 = $sortedAsc2;
            usort($sortedDesc2, fn($a, $b) => strcmp($b['fiscalYear'] ?? '', $a['fiscalYear'] ?? ''));
            foreach ($sortedDesc2 as $s) {
                $key = strtolower(($s['facilityId'] ?? '') . '|' . ($s['name'] ?? ''));
                if (isset($seen2[$key])) continue;
                $seen2[$key] = true;

                $facilityId = $s['facilityId'] ?? '';
                if (!$facilityId) continue;

                $facSlug    = inv_facility_slug($pdo, $clientId, $facilityId);
                $entityCode = inv_facility_entity($pdo, $clientId, $facilityId);
                $facLabel   = $facSlug;
                $stableId   = inv_stable_id($clientId, 's2', $facSlug, $s['name'] ?? 'source');
                $catMap     = [
                    'electricity'     => 'Grid Electricity',
                    'steam'           => 'Purchased Steam',
                    'heating'         => 'District Heating',
                    'cooling'         => 'District Cooling',
                    'solar-generated' => 'solar-generated',
                    'solar-consumed'  => 'solar-consumed',
                    'solar-exported'  => 'solar-exported',
                    'captive-wind'    => 'wind',
                ];
                $subType = $catMap[$s['category'] ?? ''] ?? 'Grid Electricity';
                $unit    = match($s['category'] ?? '') {
                    'electricity',
                    'solar-generated',
                    'solar-consumed',
                    'solar-exported',
                    'captive-wind'    => 'kWh',
                    default           => 'GJ',
                };
                inv_upsert_asset(
                    $pdo, $clientId, $stableId, $entityCode,
                    $s['name'] ?? '', $facLabel, $s['supplier'] ?? null,
                    'Scope 2', $subType, inv_status_label($s['status'] ?? 'active'), $unit,
                    $earliestFY2[$key] ?? null
                );
            }

            // Remove tracker_drafts rows for S2 assets that no longer exist in decarb_assets
            $pdo->prepare(
                "DELETE FROM tracker_drafts WHERE client_id = ? AND asset_id LIKE 'inv-s2-%'
                 AND asset_id NOT IN (SELECT asset_id FROM decarb_assets WHERE client_id = ? AND asset_id LIKE 'inv-s2-%')"
            )->execute([$clientId, $clientId]);
        }

        // ── Op control ────────────────────────────────────────────────────────

        if ($section === 'opcontrol') {
            $pdo->prepare(
                'INSERT INTO inv_op_control (client_id, kyoto, scope3)
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE kyoto = VALUES(kyoto), scope3 = VALUES(scope3)'
            )->execute([
                $clientId,
                json_encode($data['kyoto']  ?? new stdClass()),
                json_encode($data['scope3'] ?? []),
            ]);
        }

        // A client who has defined at least one Scope 1 asset or Scope 2 source has
        // defined their boundary — clear the "define your inventory boundary" prompt.
        if (in_array($section, ['scope1', 'scope2'], true) && is_array($data) && count($data) > 0
            && !in_array($user['role'] ?? '', ['deepwoods_admin', 'deepwoods_coordinator'], true)) {
            $pdo->prepare(
                "INSERT INTO client_config (client_id, config_key, config_value)
                 VALUES (?, 'inventory_complete', 'true')
                 ON DUPLICATE KEY UPDATE config_value = 'true'"
            )->execute([$clientId]);
        }

        $pdo->commit();
        dolphin_send_json(['ok' => true]);

    } catch (PDOException $e) {
        $pdo->rollBack();
        error_log('inventory-boundary.php error: ' . $e->getMessage());
        dolphin_send_json(['error' => 'Failed to save. Please try again.'], 500);
    }
}
