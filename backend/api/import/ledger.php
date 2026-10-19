<?php
// import/ledger.php
// POST { entity, year, ghg_inventory[], s1_by_facility[], s2_by_facility[],
//        s2_breakdown{}, scope3_summary[], intensity_metrics{},
//        tracker_assets[], tracker_drafts[] }
// Upserts all sections. Deepwoods-only endpoint.

declare(strict_types=1);
require_once __DIR__ . '/../db.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Allow-Methods: POST, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$user = dolphin_require_auth();
if (!in_array($user['role'] ?? '', ['deepwoods_admin', 'deepwoods_coordinator', 'sustainability_team'], true)) {
    dolphin_send_json(['error' => 'Insufficient role for ledger import'], 403);
}

$pdo    = dolphin_db();
$body   = dolphin_json_body();

$isDeepwoods = in_array($user['role'] ?? '', ['deepwoods_admin', 'deepwoods_coordinator'], true);

// Deepwoods admins may pass target_client_id to import for any client.
// Regular users (sustainability_team) use their own client_id.
if ($isDeepwoods && !empty($body['target_client_id'])) {
    $clientId = (int)$body['target_client_id'];
    // Verify that client exists
    $cc = $pdo->prepare('SELECT id FROM clients WHERE id = ?');
    $cc->execute([$clientId]);
    if (!$cc->fetch()) { dolphin_send_json(['error' => 'target_client_id not found'], 404); }
} else {
    $clientId = (int)($user['client_id'] ?? 0);
    if (!$clientId) { dolphin_send_json(['error' => 'User has no client_id'], 403); }
}

$entity = trim($body['entity'] ?? '');
$year   = trim($body['year']   ?? '');

if (!$entity || !$year) { dolphin_send_json(['error' => 'entity and year required'], 400); }

// Validate entity belongs to this client
$chk = $pdo->prepare('SELECT code FROM client_entities WHERE client_id = ? AND code = ?');
$chk->execute([$clientId, $entity]);
if (!$chk->fetch()) { dolphin_send_json(['error' => 'entity not found for this client'], 403); }

$counts = ['ghg_inventory' => 0, 's1_by_facility' => 0, 's2_by_facility' => 0,
           's2_breakdown' => 0, 'scope3_summary' => 0, 'intensity_metrics' => 0,
           'tracker_assets' => 0, 'tracker_drafts' => 0,
           'irec_register' => 0, 'decarb_actions' => 0, 'peers' => 0];

$pdo->beginTransaction();
try {

    // ── ghg_inventory ──────────────────────────────────────────────────────────
    $upsGhg = $pdo->prepare(
        'INSERT INTO ghg_inventory (client_id, entity, year, metric_key, metric_value)
         VALUES (?,?,?,?,?)
         ON DUPLICATE KEY UPDATE metric_value = VALUES(metric_value)'
    );
    foreach (($body['ghg_inventory'] ?? []) as $r) {
        $key = trim($r['metric_key'] ?? '');
        $val = isset($r['metric_value']) && is_numeric($r['metric_value']) ? (float)$r['metric_value'] : null;
        if (!$key || $val === null) continue;
        $upsGhg->execute([$clientId, $entity, $year, $key, $val]);
        $counts['ghg_inventory']++;
    }

    // ── s1_by_facility ─────────────────────────────────────────────────────────
    $pdo->prepare('DELETE FROM s1_by_facility WHERE client_id = ? AND entity = ? AND year = ?')
        ->execute([$clientId, $entity, $year]);
    $insS1Fac = $pdo->prepare(
        'INSERT INTO s1_by_facility (client_id, entity, year, facility, sub_type, tco2e) VALUES (?,?,?,?,?,?)'
    );
    foreach (($body['s1_by_facility'] ?? []) as $r) {
        $fac = trim($r['facility'] ?? ''); $st = trim($r['sub_type'] ?? 'combustion');
        $v   = isset($r['tco2e']) && is_numeric($r['tco2e']) ? (float)$r['tco2e'] : null;
        if (!$fac || $v === null) continue;
        $insS1Fac->execute([$clientId, $entity, $year, $fac, $st, $v]);
        $counts['s1_by_facility']++;
    }

    // ── s2_by_facility ─────────────────────────────────────────────────────────
    $pdo->prepare('DELETE FROM s2_by_facility WHERE client_id = ? AND entity = ? AND year = ?')
        ->execute([$clientId, $entity, $year]);
    $insS2Fac = $pdo->prepare(
        'INSERT INTO s2_by_facility (client_id, entity, year, facility, tco2e_lb, tco2e_mb) VALUES (?,?,?,?,?,?)'
    );
    foreach (($body['s2_by_facility'] ?? []) as $r) {
        $fac = trim($r['facility'] ?? '');
        $lb  = isset($r['tco2e_lb']) && is_numeric($r['tco2e_lb']) ? (float)$r['tco2e_lb'] : null;
        $mb  = isset($r['tco2e_mb']) && is_numeric($r['tco2e_mb']) ? (float)$r['tco2e_mb'] : $lb;
        if (!$fac || $lb === null) continue;
        $insS2Fac->execute([$clientId, $entity, $year, $fac, $lb, $mb]);
        $counts['s2_by_facility']++;
    }

    // ── s2_breakdown ───────────────────────────────────────────────────────────
    $bd = $body['s2_breakdown'] ?? null;
    if ($bd && is_array($bd)) {
        $gkwh = isset($bd['grid_kwh'])   && is_numeric($bd['grid_kwh'])   ? (float)$bd['grid_kwh']   : 0;
        $rkwh = isset($bd['re_kwh'])     && is_numeric($bd['re_kwh'])     ? (float)$bd['re_kwh']     : 0;
        $lb   = isset($bd['tco2e_lb'])   && is_numeric($bd['tco2e_lb'])   ? (float)$bd['tco2e_lb']   : 0;
        $mb   = isset($bd['tco2e_mb'])   && is_numeric($bd['tco2e_mb'])   ? (float)$bd['tco2e_mb']   : $lb;
        $pdo->prepare(
            'INSERT INTO s2_breakdown (client_id, entity, year, breakdown_type, grid_kwh, re_kwh, tco2e_lb, tco2e_mb)
             VALUES (?,?,?,?,?,?,?,?)
             ON DUPLICATE KEY UPDATE grid_kwh=VALUES(grid_kwh), re_kwh=VALUES(re_kwh),
                                     tco2e_lb=VALUES(tco2e_lb), tco2e_mb=VALUES(tco2e_mb)'
        )->execute([$clientId, $entity, $year, 'standard', $gkwh, $rkwh, $lb, $mb]);
        $counts['s2_breakdown'] = 1;
    }

    // ── scope3_summary ─────────────────────────────────────────────────────────
    $pdo->prepare('DELETE FROM scope3_summary WHERE client_id = ? AND entity = ? AND year = ?')
        ->execute([$clientId, $entity, $year]);
    $insS3 = $pdo->prepare(
        'INSERT INTO scope3_summary (client_id, entity, year, category, tco2e) VALUES (?,?,?,?,?)'
    );
    foreach (($body['scope3_summary'] ?? []) as $r) {
        $cat = trim($r['category'] ?? '');
        $v   = isset($r['tco2e']) && is_numeric($r['tco2e']) ? (float)$r['tco2e'] : null;
        if (!$cat || $v === null) continue;
        $insS3->execute([$clientId, $entity, $year, $cat, $v]);
        $counts['scope3_summary']++;
    }

    // ── intensity_metrics ──────────────────────────────────────────────────────
    $im = $body['intensity_metrics'] ?? null;
    if ($im && is_array($im)) {
        $rev  = isset($im['revenue_lakh'])     && is_numeric($im['revenue_lakh'])     ? (float)$im['revenue_lakh']     : null;
        $prod = isset($im['production_units']) && is_numeric($im['production_units']) ? (float)$im['production_units'] : null;
        $lb   = isset($im['s12_lb'])           && is_numeric($im['s12_lb'])           ? (float)$im['s12_lb']           : null;
        $mb   = isset($im['s12_mb'])           && is_numeric($im['s12_mb'])           ? (float)$im['s12_mb']           : $lb;
        $s3t  = isset($im['s3_total'])         && is_numeric($im['s3_total'])         ? (float)$im['s3_total']         : null;
        $pdo->prepare(
            'INSERT INTO intensity_metrics (client_id, entity, year, revenue_lakh, production_units, s12_lb, s12_mb, s3_total)
             VALUES (?,?,?,?,?,?,?,?)
             ON DUPLICATE KEY UPDATE revenue_lakh=VALUES(revenue_lakh), production_units=VALUES(production_units),
                                     s12_lb=VALUES(s12_lb), s12_mb=VALUES(s12_mb), s3_total=VALUES(s3_total)'
        )->execute([$clientId, $entity, $year, $rev, $prod, $lb, $mb, $s3t]);
        $counts['intensity_metrics'] = 1;
    }

    // ── tracker_assets → decarb_assets ─────────────────────────────────────────
    $upsAsset = $pdo->prepare(
        'INSERT INTO decarb_assets (client_id, asset_id, entity, name, facility, fuel_type, scope, sub_type, status, health, unit, active_from_fy)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE entity=VALUES(entity), name=VALUES(name), facility=VALUES(facility),
                                 fuel_type=VALUES(fuel_type), scope=VALUES(scope), sub_type=VALUES(sub_type),
                                 unit=VALUES(unit)'
    );
    foreach (($body['tracker_assets'] ?? []) as $a) {
        $aid = trim($a['asset_id'] ?? '');
        $nm  = trim($a['name']     ?? '');
        $fac = trim($a['facility'] ?? '');
        $sc  = trim($a['scope']    ?? '');
        $st  = trim($a['sub_type'] ?? '');
        $un  = trim($a['unit']     ?? '');
        if (!$aid || !$nm || !$sc) continue;
        $fuel = trim($a['fuel_type'] ?? '') ?: null;
        $upsAsset->execute([$clientId, $aid, $entity, $nm, $fac, $fuel, $sc, $st, 'Active', 'Efficient', $un, $year]);
        $counts['tracker_assets']++;
    }

    // ── tracker_drafts ─────────────────────────────────────────────────────────
    $upsDraft = $pdo->prepare(
        'INSERT INTO tracker_drafts (client_id, entity, fiscal_year, asset_id, period, value, edited_by)
         VALUES (?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE value=VALUES(value), edited_by=VALUES(edited_by), updated_at=CURRENT_TIMESTAMP'
    );
    foreach (($body['tracker_drafts'] ?? []) as $d) {
        $aid    = trim($d['asset_id'] ?? '');
        $period = trim($d['period']   ?? '');
        $val    = isset($d['value']) && is_numeric($d['value']) ? (string)(float)$d['value'] : null;
        if (!$aid || !$period) continue;
        $upsDraft->execute([$clientId, $entity, $year, $aid, $period, $val, 'ledger-import']);
        $counts['tracker_drafts']++;
    }

    // ── irec_register ──────────────────────────────────────────────────────────
    $pdo->prepare('DELETE FROM irec_register WHERE client_id = ? AND entity = ? AND year = ?')
        ->execute([$clientId, $entity, $year]);
    $insIrec = $pdo->prepare(
        'INSERT INTO irec_register (client_id, entity, year, facility, mwh, vintage, instrument, status)
         VALUES (?,?,?,?,?,?,?,?)'
    );
    foreach (($body['irec_register'] ?? []) as $r) {
        $mwh = isset($r['mwh']) && is_numeric($r['mwh']) ? (float)$r['mwh'] : null;
        if (!$mwh) continue;
        $fac  = trim($r['facility'] ?? '') ?: null;
        $vint = trim($r['vintage']  ?? '') ?: null;
        $inst = trim($r['instrument'] ?? '') ?: null;
        $stat = trim($r['status']   ?? 'Active') ?: 'Active';
        $insIrec->execute([$clientId, $entity, $year, $fac, $mwh, $vint, $inst, $stat]);
        $counts['irec_register']++;
    }

    // ── decarb_actions ─────────────────────────────────────────────────────────
    $insAct = $pdo->prepare(
        'INSERT INTO decarb_actions (client_id, entity, title, lever, status, facilities, abatement_t, timeline)
         VALUES (?,?,?,?,?,?,?,?)'
    );
    foreach (($body['decarb_actions'] ?? []) as $a) {
        $title = trim($a['title'] ?? '');
        if (!$title) continue;
        $fac  = trim($a['facility'] ?? '') ?: null;
        $facs = $fac ? json_encode([$fac]) : null;
        $lever  = trim($a['lever']  ?? 'other');
        $status = trim($a['status'] ?? 'Planned');
        $ab     = isset($a['abatement_t']) && is_numeric($a['abatement_t']) ? (float)$a['abatement_t'] : null;
        $tl     = trim($a['target_year'] ?? '') ?: null;
        $insAct->execute([$clientId, $entity, $title, $lever, $status, $facs, $ab, $tl]);
        $counts['decarb_actions']++;
    }

    // ── peers + peer_trends ────────────────────────────────────────────────────
    $upsPeer  = $pdo->prepare(
        'INSERT INTO peers (client_id, name) VALUES (?,?)
         ON DUPLICATE KEY UPDATE name=VALUES(name)'
    );
    $getPeerId = $pdo->prepare('SELECT id FROM peers WHERE client_id=? AND name=?');
    $upsTrend  = $pdo->prepare(
        'INSERT INTO peer_trends (client_id, peer_id, fy, scope1, scope2_lb, scope2_mb, scope3_total, intensity_revenue)
         VALUES (?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE scope1=VALUES(scope1), scope2_lb=VALUES(scope2_lb),
                                 scope3_total=VALUES(scope3_total), intensity_revenue=VALUES(intensity_revenue)'
    );
    foreach (($body['peer_data'] ?? []) as $p) {
        $name = trim($p['name'] ?? '');
        $pfy  = trim($p['fy']   ?? $year);
        if (!$name || !$pfy) continue;
        $upsPeer->execute([$clientId, $name]);
        $getPeerId->execute([$clientId, $name]);
        $peerRow = $getPeerId->fetch(PDO::FETCH_ASSOC);
        if (!$peerRow) continue;
        $pid   = (int)$peerRow['id'];
        $s12   = isset($p['scope12'])           && is_numeric($p['scope12'])           ? (float)$p['scope12']           : null;
        $s3t   = isset($p['scope3_total'])       && is_numeric($p['scope3_total'])       ? (float)$p['scope3_total']       : null;
        $intr  = isset($p['intensity_revenue'])  && is_numeric($p['intensity_revenue'])  ? (float)$p['intensity_revenue']  : null;
        $upsTrend->execute([$clientId, $pid, $pfy, $s12, $s12, $s12, $s3t, $intr]);
        $counts['peers']++;
    }

    $pdo->commit();
    dolphin_send_json(['ok' => true, 'counts' => $counts]);

} catch (PDOException $e) {
    $pdo->rollBack();
    error_log('ledger import error: ' . $e->getMessage());
    dolphin_send_json(['error' => 'DB error: ' . $e->getMessage()], 500);
}
