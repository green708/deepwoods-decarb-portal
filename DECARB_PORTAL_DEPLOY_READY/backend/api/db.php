<?php
declare(strict_types=1);

function dolphin_config(): array {
    static $config = null;
    if ($config === null) {
        $path = __DIR__ . '/../config.php';
        if (!file_exists($path)) {
            http_response_code(500);
            die(json_encode(['error' => 'config.php missing — copy config.php.example and fill it in']));
        }
        $config = require $path;
    }
    return $config;
}

function dolphin_db(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $c = dolphin_config()['db'];
        $dsn = "mysql:host={$c['host']};dbname={$c['name']};charset=utf8mb4";
        $pdo = new PDO($dsn, $c['user'], $c['pass'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    }
    return $pdo;
}

// Very basic shared-secret check — kept only for endpoints that must be
// reachable before a real login exists (login.php itself, forgot-password.php).
function dolphin_require_api_key(): void {
    $headers = getallheaders();
    $sent = $headers['X-Api-Key'] ?? $headers['x-api-key'] ?? '';
    if (!hash_equals(dolphin_config()['api_key'], $sent)) {
        http_response_code(401);
        die(json_encode(['error' => 'Unauthorized']));
    }
}

// Real per-user auth. Frontend sends the session token from login as
// `Authorization: Bearer <token>`. Returns the authenticated user's row
// (id, email, role, must_change_password) or dies 401.
function dolphin_require_auth(): array {
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    if (!preg_match('/^Bearer\s+(.+)$/i', $authHeader, $m)) {
        http_response_code(401);
        die(json_encode(['error' => 'Missing or malformed Authorization header']));
    }
    $token = $m[1];

    $pdo = dolphin_db();
    $stmt = $pdo->prepare(
        'SELECT u.id, u.email, u.role, u.client_id, u.entity_scope, u.must_change_password
         FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token = ? AND s.expires_at > NOW()'
    );
    $stmt->execute([$token]);
    $user = $stmt->fetch();

    if (!$user) {
        http_response_code(401);
        die(json_encode(['error' => 'Session expired or invalid — please log in again']));
    }
    return $user;
}

function dolphin_generate_token(): string {
    return bin2hex(random_bytes(32));
}

function dolphin_json_body(): array {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function dolphin_send_json($data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

/**
 * Server-side activation gate for client-role users.
 * Call at the top of any endpoint that should be blocked until Deepwoods activates the client.
 * Deepwoods roles bypass this check entirely.
 */
function dolphin_require_active_client(array $authUser): void {
    static $deepwoodsRoles = ['deepwoods_admin', 'deepwoods_coordinator'];
    if (in_array($authUser['role'], $deepwoodsRoles, true)) return;
    $clientId = (int)($authUser['client_id'] ?? 0);
    if (!$clientId) return;
    $pdo  = dolphin_db();
    $stmt = $pdo->prepare('SELECT is_active FROM clients WHERE id = ?');
    $stmt->execute([$clientId]);
    $row  = $stmt->fetch();
    if (!$row || !(bool)$row['is_active']) {
        dolphin_send_json([
            'error'   => 'client_not_activated',
            'message' => 'Your account is pending activation by Deepwoods.',
        ], 403);
    }
}

/**
 * Feature-access gate: requires payment_status = 'paid' or 'waived'.
 * Apply to every endpoint that serves paid GHG content (inventory, S1/S2/S3,
 * intensity, facilities, vault, submissions, decarb, credits, peers, reports).
 * Deepwoods staff bypass this check so they can always inspect client data.
 */
function dolphin_require_payment(array $authUser): void {
    static $deepwoodsRoles = ['deepwoods_admin', 'deepwoods_coordinator'];
    if (in_array($authUser['role'], $deepwoodsRoles, true)) return;

    $clientId = (int)($authUser['client_id'] ?? 0);
    if (!$clientId) return;

    $pdo  = dolphin_db();
    $stmt = $pdo->prepare('SELECT payment_status FROM clients WHERE id = ?');
    $stmt->execute([$clientId]);
    $row  = $stmt->fetch();

    if (!$row || !in_array($row['payment_status'] ?? 'pending', ['paid', 'waived'], true)) {
        dolphin_send_json([
            'error'   => 'payment_required',
            'message' => 'This feature is available once your annual access payment is confirmed.',
        ], 402);
    }
}

/**
 * Entity-scope gate: validates that $requestedEntity belongs to the user's client
 * and enforces entity_scope for scoped users.
 *
 * Returns the validated, canonical entity code to use in the query.
 * Dies 403 if the entity does not belong to this client.
 *
 * Deepwoods staff pass through without entity validation because they operate
 * across clients through explicit client context.
 */
function dolphin_validate_entity(array $authUser, string $requestedEntity): string {
    static $deepwoodsRoles = ['deepwoods_admin', 'deepwoods_coordinator'];

    // Scoped users are always locked to their assigned entity regardless of what was requested
    if (!empty($authUser['entity_scope'])) {
        return (string)$authUser['entity_scope'];
    }

    // Deepwoods staff: pass through without entity membership check
    if (in_array($authUser['role'], $deepwoodsRoles, true)) {
        return $requestedEntity;
    }

    // Client users: verify the requested entity actually belongs to their client
    $clientId = (int)($authUser['client_id'] ?? 0);
    if (!$clientId || $requestedEntity === '') return $requestedEntity;

    $pdo  = dolphin_db();
    $stmt = $pdo->prepare('SELECT code FROM client_entities WHERE client_id = ? AND code = ?');
    $stmt->execute([$clientId, $requestedEntity]);
    if (!$stmt->fetch()) {
        dolphin_send_json([
            'error'   => 'entity_forbidden',
            'message' => 'You do not have access to the requested entity.',
        ], 403);
    }
    return $requestedEntity;
}

// CORS + preflight — the static site and this API sit on the same domain in
// production, but this makes local frontend dev against the live API painless.
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, X-Api-Key, Authorization');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Make $pdo available as a global in every file that requires db.php.
// dolphin_db() is a singleton so this is a zero-cost second call.
$pdo = dolphin_db();
