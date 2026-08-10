<?php
declare(strict_types=1);
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/Smtp.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    dolphin_send_json(['error' => 'POST only'], 405);
}

$config = dolphin_config();
$body   = dolphin_json_body();

// ── Validate ────────────────────────────────────────────────────────────────
$name    = trim($body['name']      ?? '');
$company = trim($body['company']   ?? '');
$email   = trim(strtolower($body['email'] ?? ''));
$phone   = trim($body['phone']     ?? '');
$employees = trim($body['employees'] ?? '');
$message = trim($body['message']   ?? '');

$errors = [];
if ($name === '')                      $errors[] = 'Name is required.';
if ($company === '')                   $errors[] = 'Company is required.';
if ($email === '')                     $errors[] = 'Email is required.';
elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[] = 'Email is not valid.';

if ($errors) {
    dolphin_send_json(['error' => implode(' ', $errors)], 422);
}

// ── Insert into DB ───────────────────────────────────────────────────────────
$pdo = dolphin_db();

try {
    $stmt = $pdo->prepare(
        'INSERT INTO client_requests (name, company, email, phone, employees, message)
         VALUES (?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $name,
        $company,
        $email,
        $phone ?: null,
        $employees ?: null,
        $message ?: null,
    ]);
} catch (PDOException $e) {
    // Duplicate email (or any constraint error) — return success to avoid info leak
    if (str_starts_with($e->getCode(), '23')) {
        dolphin_send_json(['ok' => true, 'message' => 'Request received']);
    }
    error_log('request-access INSERT failed: ' . $e->getMessage());
    dolphin_send_json(['error' => 'Could not save your request. Please try again.'], 500);
}

// ── Send emails ──────────────────────────────────────────────────────────────
$platformName = $config['platform_name'] ?? 'Deepwoods GHG Portal';
$adminEmail   = $config['admin_email']   ?? ($config['smtp']['username'] ?? null);

$smtpReady = !empty($config['smtp']['host'])
          && !empty($config['smtp']['username'])
          && !empty($config['smtp']['app_password']);

if ($smtpReady && $adminEmail) {
    try {
        $smtp = new Smtp(
            $config['smtp']['host'],
            $config['smtp']['port'],
            $config['smtp']['username'],
            $config['smtp']['app_password'],
            $config['smtp']['from_email'],
            $config['smtp']['from_name']
        );

        // ── Notification to Deepwoods ──────────────────────────────────────
        $phoneDisplay    = $phone    ?: '(not provided)';
        $employeesDisplay = $employees ?: '(not provided)';
        $messageDisplay  = $message  ?: '(no message)';

        $notifyHtml = "
<html><body style='font-family:Arial,sans-serif;color:#1a1a1a;max-width:600px;margin:0 auto'>
  <div style='background:#1E6F5C;padding:24px 32px;border-radius:8px 8px 0 0'>
    <h2 style='color:#fff;margin:0;font-size:20px'>{$platformName}</h2>
    <p style='color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:14px'>New Request Access submission</p>
  </div>
  <div style='background:#f9fafb;padding:24px 32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px'>
    <table style='width:100%;border-collapse:collapse;font-size:14px'>
      <tr><td style='padding:8px 0;color:#6b7280;width:120px'>Name</td>
          <td style='padding:8px 0;font-weight:600'>" . htmlspecialchars($name) . "</td></tr>
      <tr><td style='padding:8px 0;color:#6b7280'>Company</td>
          <td style='padding:8px 0;font-weight:600'>" . htmlspecialchars($company) . "</td></tr>
      <tr><td style='padding:8px 0;color:#6b7280'>Email</td>
          <td style='padding:8px 0'><a href='mailto:" . htmlspecialchars($email) . "' style='color:#1E6F5C'>" . htmlspecialchars($email) . "</a></td></tr>
      <tr><td style='padding:8px 0;color:#6b7280'>Phone</td>
          <td style='padding:8px 0'>" . htmlspecialchars($phoneDisplay) . "</td></tr>
      <tr><td style='padding:8px 0;color:#6b7280'>Employees</td>
          <td style='padding:8px 0'>" . htmlspecialchars($employeesDisplay) . "</td></tr>
    </table>
    <div style='margin-top:16px;padding-top:16px;border-top:1px solid #e5e7eb'>
      <p style='color:#6b7280;font-size:13px;margin:0 0 6px'>Message</p>
      <p style='margin:0;font-size:14px;white-space:pre-wrap'>" . htmlspecialchars($messageDisplay) . "</p>
    </div>
    <div style='margin-top:20px;padding:12px 16px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;font-size:13px;color:#92400e'>
      Reply directly to <strong>" . htmlspecialchars($email) . "</strong> to follow up with this prospect.
    </div>
  </div>
</body></html>";

        $smtp->send($adminEmail, "New Request Access — {$company}", $notifyHtml);

        // ── Confirmation to requester ──────────────────────────────────────
        $confirmHtml = "
<html><body style='font-family:Arial,sans-serif;color:#1a1a1a;max-width:600px;margin:0 auto'>
  <div style='background:#1E6F5C;padding:24px 32px;border-radius:8px 8px 0 0'>
    <h2 style='color:#fff;margin:0;font-size:20px'>{$platformName}</h2>
    <p style='color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:14px'>Request received</p>
  </div>
  <div style='background:#f9fafb;padding:24px 32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px'>
    <p style='font-size:15px;margin:0 0 16px'>Hi " . htmlspecialchars($name) . ",</p>
    <p style='font-size:14px;line-height:1.7;margin:0 0 16px'>
      Thank you for your interest in the Deepwoods GHG Reporting Platform.
      We've received your request and our team will be in touch within <strong>2 business days</strong>.
    </p>
    <p style='font-size:14px;line-height:1.7;margin:0 0 24px'>
      In the meantime, feel free to reply to this email if you have any questions.
    </p>
    <p style='font-size:13px;color:#6b7280;margin:0'>
      — The Deepwoods Green Advisory team
    </p>
  </div>
</body></html>";

        $smtp->send($email, "We've received your request — {$platformName}", $confirmHtml);

    } catch (Throwable $e) {
        // Email failure is non-fatal — the request is already saved to DB
        error_log('request-access email failed: ' . $e->getMessage());
    }
}

dolphin_send_json(['ok' => true, 'message' => 'Request received']);
