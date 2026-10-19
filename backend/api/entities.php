<?php
// entities.php — POST /backend/api/entities.php
// Upserts client_entities records (name, legal_address, status) for the logged-in client.

declare(strict_types=1);
require_once __DIR__ . '/db.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Allow-Methods: POST, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit;
}

$auth = dolphin_require_auth();
dolphin_require_active_client($auth);

$clientId = (int)$auth['client_id'];
$body     = dolphin_json_body();
$items    = $body['facilities'] ?? [];

if (!is_array($items) || count($items) === 0) {
    http_response_code(400); echo json_encode(['error' => 'facilities array required']); exit;
}

$pdo = dolphin_db();

$updated = 0;
$inserted = 0;

foreach ($items as $item) {
    $code    = isset($item['code']) ? trim((string)$item['code']) : null;
    $name    = trim((string)($item['name'] ?? ''));
    $address = trim((string)($item['legal_address'] ?? ''));
    $status  = in_array($item['status'] ?? '', ['active', 'stopped'], true) ? $item['status'] : 'active';

    if (!$name) continue;

    if ($code) {
        // Update existing entity
        $stmt = $pdo->prepare(
            'UPDATE client_entities SET name = ?, legal_address = ?, status = ? WHERE client_id = ? AND code = ?'
        );
        $stmt->execute([$name, $address ?: null, $status, $clientId, $code]);
        $updated += $stmt->rowCount();
    } else {
        // Insert new entity
        $newCode = strtoupper(preg_replace('/[^A-Z0-9]/', '', $name));
        $newCode = substr($newCode, 0, 8) ?: 'ENT' . time();
        // Ensure unique code
        $check = $pdo->prepare('SELECT COUNT(*) FROM client_entities WHERE client_id = ? AND code = ?');
        $check->execute([$clientId, $newCode]);
        if ((int)$check->fetchColumn() > 0) {
            $newCode .= rand(1, 99);
        }
        $pdo->prepare(
            'INSERT INTO client_entities (client_id, code, name, legal_address, status) VALUES (?,?,?,?,?)'
        )->execute([$clientId, $newCode, $name, $address ?: null, $status]);
        $inserted++;
    }
}

echo json_encode(['ok' => true, 'updated' => $updated, 'inserted' => $inserted]);
