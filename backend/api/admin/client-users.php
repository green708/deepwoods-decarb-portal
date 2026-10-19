<?php
// admin/client-users.php — GET / POST. Deepwoods staff manage the users of one client.
// Inviting is handled by invite-user.php; this endpoint edits, resets and removes existing users.

declare(strict_types=1);
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../lib_admin.php';
require_once __DIR__ . '/../lib_portal.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Headers: Content-Type, X-Api-Key, Authorization');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');

const CLIENT_USER_ROLES = ['sustainability_team', 'client_uploader', 'client_leadership'];

$user   = dolphin_require_auth();
dolphin_require_deepwoods($user);
$method = dolphin_require_method(['GET', 'POST']);
$pdo    = dolphin_db();
$body   = $method === 'POST' ? dolphin_json_body() : null;
$clientId = dolphin_staff_client_id($body);
dolphin_client_or_404($pdo, $clientId);
$email = (string)$user['email'];

if ($method === 'GET') {
    $st = $pdo->prepare(
        'SELECT u.id, u.email, u.display_name, u.role, u.entity_scope, u.must_change_password, u.created_at,
                (SELECT MAX(s.created_at) FROM sessions s WHERE s.user_id = u.id) AS last_login
         FROM users u WHERE u.client_id = ? ORDER BY u.created_at, u.id'
    );
    $st->execute([$clientId]);
    $users = [];
    foreach ($st->fetchAll() as $r) {
        $users[] = [
            'id'                   => (int)$r['id'],
            'email'                => $r['email'],
            'display_name'         => $r['display_name'],
            'role'                 => $r['role'],
            'entity_scope'         => $r['entity_scope'],
            'must_change_password' => (bool)$r['must_change_password'],
            'last_login'           => dolphin_iso($r['last_login']),
            'created_at'           => dolphin_iso($r['created_at']),
        ];
    }
    dolphin_send_json(['users' => $users]);
}

// ── POST ────────────────────────────────────────────────────────────────────
$action = (string)($body['action'] ?? '');
if (!in_array($action, ['update', 'reset_password', 'remove'], true)) {
    dolphin_send_json(['error' => 'action must be update, reset_password or remove'], 400);
}
$userId = (int)($body['user_id'] ?? 0);
if ($userId <= 0) dolphin_send_json(['error' => 'user_id is required'], 400);

$st = $pdo->prepare('SELECT id, email, role, entity_scope, display_name FROM users WHERE id = ? AND client_id = ?');
$st->execute([$userId, $clientId]);
$target = $st->fetch();
if (!$target) dolphin_send_json(['error' => 'User not found for this client'], 404);

/** True when $userId is the only sustainability_team user of the client. */
$isLastAdmin = static function () use ($pdo, $clientId, $userId): bool {
    $st = $pdo->prepare("SELECT COUNT(*) FROM users WHERE client_id = ? AND role = 'sustainability_team' AND id <> ?");
    $st->execute([$clientId, $userId]);
    return (int)$st->fetchColumn() === 0;
};

if ($action === 'update') {
    $sets = []; $vals = []; $errors = []; $changes = [];

    if (array_key_exists('display_name', $body)) {
        $dn = $body['display_name'];
        if ($dn !== null && !is_string($dn)) $errors['display_name'] = 'must be a string or null';
        else {
            $dn = $dn === null ? null : trim($dn);
            if ($dn === '') $dn = null;
            if ($dn !== null && mb_strlen($dn) > 120) $errors['display_name'] = 'too long (max 120 characters)';
            else { $sets[] = 'display_name = ?'; $vals[] = $dn; $changes[] = 'display_name'; }
        }
    }
    if (array_key_exists('role', $body)) {
        if (!is_string($body['role']) || !in_array($body['role'], CLIENT_USER_ROLES, true)) {
            $errors['role'] = 'must be one of ' . implode(', ', CLIENT_USER_ROLES);
        } else {
            if ($target['role'] === 'sustainability_team' && $body['role'] !== 'sustainability_team' && $isLastAdmin()) {
                $errors['role'] = 'cannot demote the last sustainability_team user of this client';
            }
            $sets[] = 'role = ?'; $vals[] = $body['role']; $changes[] = 'role';
        }
    }
    if (array_key_exists('entity_scope', $body)) {
        $scope = $body['entity_scope'];
        if ($scope === '' ) $scope = null;
        if ($scope !== null && !is_string($scope)) {
            $errors['entity_scope'] = 'must be an entity code or null';
        } else {
            if ($scope !== null) {
                $st = $pdo->prepare('SELECT 1 FROM client_entities WHERE client_id = ? AND code = ?');
                $st->execute([$clientId, $scope]);
                if (!$st->fetchColumn()) $errors['entity_scope'] = 'must be an entity code of this client or null';
            }
            if (!isset($errors['entity_scope'])) { $sets[] = 'entity_scope = ?'; $vals[] = $scope; $changes[] = 'entity_scope'; }
        }
    }
    if ($errors) dolphin_validation_failed($errors);
    if (!$sets) dolphin_send_json(['error' => 'Nothing to update (provide display_name, role or entity_scope)'], 400);

    $vals[] = $userId; $vals[] = $clientId;
    $pdo->prepare('UPDATE users SET ' . implode(', ', $sets) . ' WHERE id = ? AND client_id = ?')->execute($vals);
    dolphin_log_activity($pdo, $clientId, $email, 'user_updated', $target['email'] . ': ' . implode(', ', $changes));

    $st = $pdo->prepare('SELECT id, email, display_name, role, entity_scope FROM users WHERE id = ?');
    $st->execute([$userId]);
    $r = $st->fetch();
    dolphin_send_json(['ok' => true, 'user' => [
        'id' => (int)$r['id'], 'email' => $r['email'], 'display_name' => $r['display_name'],
        'role' => $r['role'], 'entity_scope' => $r['entity_scope'],
    ]]);
}

if ($action === 'reset_password') {
    $temp = bin2hex(random_bytes(8));
    $pdo->beginTransaction();
    try {
        $pdo->prepare('UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ? AND client_id = ?')
            ->execute([password_hash($temp, PASSWORD_BCRYPT), $userId, $clientId]);
        $pdo->prepare('DELETE FROM sessions WHERE user_id = ?')->execute([$userId]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        error_log('client-users reset_password failed: ' . $e->getMessage());
        dolphin_send_json(['error' => 'Failed to reset password'], 500);
    }
    dolphin_log_activity($pdo, $clientId, $email, 'user_password_reset', (string)$target['email']);
    dolphin_send_json(['ok' => true, 'temp_password' => $temp]);
}

// remove
dolphin_require_deepwoods($user, true);
if ($target['role'] === 'sustainability_team' && $isLastAdmin()) {
    dolphin_send_json(['error' => 'Cannot remove the last sustainability_team user of this client'], 409);
}
$pdo->beginTransaction();
try {
    $pdo->prepare('DELETE FROM sessions WHERE user_id = ?')->execute([$userId]);
    $pdo->prepare('DELETE FROM users WHERE id = ? AND client_id = ?')->execute([$userId, $clientId]);
    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('client-users remove failed: ' . $e->getMessage());
    dolphin_send_json(['error' => 'Failed to remove user (the account may be referenced elsewhere)'], 500);
}
dolphin_log_activity($pdo, $clientId, $email, 'user_removed', (string)$target['email']);
dolphin_send_json(['ok' => true]);
