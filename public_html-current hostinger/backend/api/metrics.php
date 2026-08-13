<?php
declare(strict_types=1);
require __DIR__ . '/db.php';

// GET: returns computed metrics for a client/year as { metric_key: value }
// POST: publishes/updates one metric (admin action, after Claude has
//       computed a value and a human confirms it's ready to go live)

$authUser = dolphin_require_auth();
dolphin_require_active_client($authUser);
$pdo = dolphin_db();

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $authUser['role'] !== 'deepwoods_admin') {
    dolphin_send_json(['error' => 'Admin only'], 403);
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    dolphin_require_payment($authUser);
    $clientId = (int)($authUser['client_id'] ?? 0);
    if (!$clientId) { dolphin_send_json([]); }
    $year     = $_GET['year'] ?? '';

    $stmt = $pdo->prepare(
        'SELECT metric_key, metric_value FROM computed_metrics
         WHERE client_id = ? AND year = ?'
    );
    $stmt->execute([$clientId, $year]);

    $out = [];
    foreach ($stmt->fetchAll() as $row) {
        $out[$row['metric_key']] = (float) $row['metric_value'];
    }
    dolphin_send_json($out);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body        = dolphin_json_body();
    $clientId    = $authUser['client_id'];
    $year        = $body['year'] ?? '';
    $metricKey   = $body['metric_key'] ?? '';
    $metricValue = $body['metric_value'] ?? null;

    if ($year === '' || $metricKey === '' || $metricValue === null) {
        dolphin_send_json(['error' => 'year, metric_key, metric_value are required'], 400);
    }

    $stmt = $pdo->prepare(
        'INSERT INTO computed_metrics (client_id, year, metric_key, metric_value) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE metric_value = VALUES(metric_value)'
    );
    $stmt->execute([$clientId, $year, $metricKey, $metricValue]);

    dolphin_send_json(['ok' => true]);
}

dolphin_send_json(['error' => 'GET or POST only'], 405);
