<?php
declare(strict_types=1);
require __DIR__ . '/db.php';
require __DIR__ . '/Smtp.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    dolphin_send_json(['error' => 'POST only'], 405);
}

$config = dolphin_config();
$body = dolphin_json_body();
$email = trim(strtolower($body['email'] ?? ''));

// Always return the same generic response whether or not the email exists —
// otherwise this endpoint could be used to check who has an account here.
$generic = ['ok' => true, 'message' => 'If that email has an account, a reset link has been sent.'];

if ($email === '') {
    dolphin_send_json($generic);
}

$pdo = dolphin_db();
$stmt = $pdo->prepare('SELECT id, email FROM users WHERE email = ?');
$stmt->execute([$email]);
$user = $stmt->fetch();

if ($user) {
    $token = dolphin_generate_token();
    $expires = (new DateTime('+1 hour'))->format('Y-m-d H:i:s');
    $pdo->prepare('INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)')
        ->execute([$user['id'], $token, $expires]);

    $resetUrl = rtrim($config['app_base_url'], '/') . '/reset-password?token=' . urlencode($token);

    $platformName = $config['platform_name'] ?? 'Decarbonisation Portal';
    $html = "
        <p>Someone requested a password reset for your {$platformName} account ({$user['email']}).</p>
        <p><a href=\"{$resetUrl}\">Click here to set a new password</a> — this link expires in 1 hour.</p>
        <p>If you didn't request this, you can safely ignore this email.</p>
    ";

    try {
        $smtp = new Smtp(
            $config['smtp']['host'],
            $config['smtp']['port'],
            $config['smtp']['username'],
            $config['smtp']['app_password'],
            $config['smtp']['from_email'],
            $config['smtp']['from_name']
        );
        $smtp->send($user['email'], "Reset your {$platformName} password", $html);
    } catch (Throwable $e) {
        // Log server-side but still return the generic response to the caller.
        error_log('Password reset email failed: ' . $e->getMessage());
    }
}

dolphin_send_json($generic);
