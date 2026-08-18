<?php
// debug.php — crash-safe diagnostic
if (($_GET['key'] ?? '') !== 'dolphin_debug_2024') {
    http_response_code(401);
    echo '{"error":"Pass ?key=dolphin_debug_2024"}';
    exit;
}

$out = array('step' => 'start', 'php' => PHP_VERSION, 'sapi' => php_sapi_name());
register_shutdown_function(function() use (&$out) {
    $err = error_get_last();
    if ($err !== null) { $out['shutdown_error'] = $err; }
    if (!headers_sent()) { header('Content-Type: application/json'); }
    echo json_encode($out, JSON_PRETTY_PRINT);
});

// Step 1 — config
$configPath = __DIR__ . '/../config.php';
$out['config_exists'] = file_exists($configPath);
if (!$out['config_exists']) { $out['step'] = 'no_config'; return; }
$out['step'] = 'config_load';
$cfg = require $configPath;
$out['step'] = 'config_loaded';

// Step 2 — DB connect
$out['step'] = 'db_connect';
$db  = $cfg['db'];
$dsn = 'mysql:host=' . $db['host'] . ';dbname=' . $db['name'] . ';charset=utf8mb4';
try {
    $pdo = new PDO($dsn, $db['user'], $db['pass'], array(PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION));
    $out['step']       = 'db_ok';
    $out['db_version'] = $pdo->query('SELECT VERSION()')->fetchColumn();
    $out['db_name']    = $pdo->query('SELECT DATABASE()')->fetchColumn();
} catch (Exception $e) {
    $out['db_error'] = $e->getMessage();
    return;
}

// Step 3 — exact clients.php GET query
$out['step'] = 'clients_full_query';
try {
    $rows = $pdo->query(
        "SELECT c.id, c.name, c.slug, c.logo_url, c.primary_color,
                c.currency, c.reporting_period, c.is_active, c.activated_at, c.created_at,
                (SELECT cc.config_value FROM client_config cc
                 WHERE cc.client_id = c.id AND cc.config_key = 'setup_complete') AS setup_complete,
                (SELECT cc2.config_value FROM client_config cc2
                 WHERE cc2.client_id = c.id AND cc2.config_key = 'industry') AS industry,
                (SELECT cc3.config_value FROM client_config cc3
                 WHERE cc3.client_id = c.id AND cc3.config_key = 'consolidation_approach') AS consolidation_approach,
                (SELECT COUNT(*) FROM users u WHERE u.client_id = c.id) AS user_count,
                (SELECT COUNT(*) FROM client_entities ce WHERE ce.client_id = c.id) AS entity_count
         FROM clients c
         ORDER BY c.created_at DESC"
    )->fetchAll(PDO::FETCH_ASSOC);
    $out['clients_full_query'] = 'OK — ' . count($rows) . ' row(s)';
} catch (Exception $e) {
    $out['clients_full_query_error'] = $e->getMessage();
}

// Step 4 — exact activate-client.php GET query
$out['step'] = 'activate_full_query';
try {
    $rows = $pdo->query(
        "SELECT c.id, c.name, c.slug, c.is_active, c.activated_at, c.created_at,
                c.invoice_ref, c.payment_status, c.payment_date, c.payment_notes,
                (SELECT COUNT(*) FROM users u WHERE u.client_id = c.id) AS user_count,
                (SELECT cc.config_value FROM client_config cc
                 WHERE cc.client_id = c.id AND cc.config_key = 'setup_complete') AS setup_complete,
                (SELECT cc2.config_value FROM client_config cc2
                 WHERE cc2.client_id = c.id AND cc2.config_key = 'ghg_setup_done') AS ghg_setup_done,
                (SELECT cc3.config_value FROM client_config cc3
                 WHERE cc3.client_id = c.id AND cc3.config_key = 'contact_email') AS contact_email,
                (SELECT cc4.config_value FROM client_config cc4
                 WHERE cc4.client_id = c.id AND cc4.config_key = 'payment_requested') AS payment_requested,
                (SELECT cc5.config_value FROM client_config cc5
                 WHERE cc5.client_id = c.id AND cc5.config_key = 'payment_complete') AS payment_complete
         FROM clients c
         ORDER BY c.created_at DESC"
    )->fetchAll(PDO::FETCH_ASSOC);
    $out['activate_full_query'] = 'OK — ' . count($rows) . ' row(s)';
} catch (Exception $e) {
    $out['activate_full_query_error'] = $e->getMessage();
}

// Step 5 — exact client-requests.php GET query
$out['step'] = 'client_requests_query';
try {
    $rows = $pdo->query(
        "SELECT id, name, company, email, phone, employees, message,
                COALESCE(industry,        '') AS industry,
                COALESCE(is_india,        1)  AS is_india,
                COALESCE(gstin,           '') AS gstin,
                COALESCE(legal_name,      '') AS legal_name,
                COALESCE(operating_name,  '') AS operating_name,
                COALESCE(org_type,        '') AS org_type,
                is_msme,
                COALESCE(legal_address,   '') AS legal_address,
                COALESCE(website,         '') AS website,
                status, created_at, updated_at
         FROM client_requests
         ORDER BY
           FIELD(status,'new','contacted','rejected','converted'),
           created_at DESC"
    )->fetchAll(PDO::FETCH_ASSOC);
    $out['client_requests_query'] = 'OK — ' . count($rows) . ' row(s)';
} catch (Exception $e) {
    $out['client_requests_query_error'] = $e->getMessage();
}

// Step 6 — Smtp.php load test
$out['step'] = 'smtp_load';
try {
    require_once __DIR__ . '/Smtp.php';
    $out['smtp_load'] = class_exists('Smtp') ? 'OK' : 'loaded but class missing';
} catch (Exception $e) { $out['smtp_load'] = 'Exception: ' . $e->getMessage(); }
  catch (Error $e)     { $out['smtp_load'] = 'Error: ' . $e->getMessage(); }

// Step 7 — describe client_requests columns
$out['step'] = 'client_requests_cols';
try {
    $cols = $pdo->query("DESCRIBE client_requests")->fetchAll(PDO::FETCH_COLUMN);
    $out['client_requests_cols'] = $cols;
} catch (Exception $e) {
    $out['client_requests_cols_error'] = $e->getMessage();
}

$out['step'] = 'done';
