<?php
// auth_middleware.php — Multi-client session token validation
// Used by every protected endpoint (context.php, ghg/*.php, etc.)
//
// requireAuth() validates the Bearer token and returns:
//   ['user_id', 'email', 'role', 'client_id', 'entity_scope', 'must_change_password']
//
// entity_scope: NULL        = full access (admin / consolidated view)
//               'CORP'      = example: single entity scoped access
//               (any code from client_entities.code for the user's client)
//
// Every API endpoint should honour entity_scope when filtering data:
//   if ($authUser['entity_scope']) { WHERE entity = :scope }
//
// Relies on dolphin_db() from db.php — db.php must be required before this file.

function requireAuth(): array {
    $headers = getallheaders();
    $auth = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    if (!preg_match('/^Bearer\s+(.+)$/i', $auth, $m)) {
        http_response_code(401);
        echo json_encode(['error' => 'Missing or malformed Authorization header']);
        exit;
    }
    $token = $m[1];

    $pdo = dolphin_db();
    $stmt = $pdo->prepare(
        "SELECT s.user_id, u.email, u.role, u.client_id, u.entity_scope, u.must_change_password
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token = ? AND s.expires_at > NOW()"
    );
    $stmt->execute([$token]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        http_response_code(401);
        echo json_encode(['error' => 'Session expired or invalid — please log in again']);
        exit;
    }

    if (empty($user['client_id'])) {
        http_response_code(403);
        echo json_encode(['error' => 'User is not associated with a client']);
        exit;
    }

    return $user;
}
