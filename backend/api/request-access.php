<?php
declare(strict_types=1);
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/Smtp.php';

$method = $_SERVER['REQUEST_METHOD'];

// ── GET — fetch prefill data for the current user ─────────────────────────────
if ($method === 'GET') {
    $authUser = dolphin_require_auth();
    $email    = strtolower(trim($authUser['email'] ?? ''));
    if (!$email) {
        dolphin_send_json(null);
    }
    $pdo  = dolphin_db();
    $stmt = $pdo->prepare(
        'SELECT company, legal_name, operating_name, industry, org_type,
                is_india, gstin, is_msme, udyam_number, legal_address, website, logo_url
         FROM client_requests
         WHERE email = ?
         ORDER BY created_at DESC
         LIMIT 1'
    );
    $stmt->execute([$email]);
    $row = $stmt->fetch() ?: null;
    dolphin_send_json($row);
}

if ($method !== 'POST') {
    dolphin_send_json(['error' => 'GET or POST only'], 405);
}

$config = dolphin_config();
$body   = dolphin_json_body();

// ── Validate required fields ─────────────────────────────────────────────────
$name    = trim($body['name']    ?? '');
$company = trim($body['company'] ?? '');
$email   = trim(strtolower($body['email'] ?? ''));
$phone   = trim($body['phone']   ?? '');

// Extended fields (migration 004)
$industry      = trim($body['industry']       ?? '');
$isIndia       = isset($body['is_india'])     ? (int)(bool)$body['is_india'] : 1;
$gstin         = strtoupper(trim($body['gstin']         ?? ''));
$legalName     = trim($body['legal_name']     ?? '');
$operatingName = trim($body['operating_name'] ?? '');
$orgType       = trim($body['org_type']       ?? '');
$isMsme        = isset($body['is_msme'])      ? (int)(bool)$body['is_msme']  : null;
$udyamNumber   = trim($body['udyam_number']   ?? '');
$legalAddress  = trim($body['legal_address']  ?? '');
$website       = trim($body['website']        ?? '');
$logoUrl       = isset($body['logo_url']) && is_string($body['logo_url']) ? $body['logo_url'] : '';

$errors = [];
if ($name === '')    $errors[] = 'Your name is required.';
if ($company === '') $errors[] = 'Company name is required.';
if ($email === '')   $errors[] = 'Email is required.';
elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[] = 'Email is not valid.';

if ($errors) {
    dolphin_send_json(['error' => implode(' ', $errors)], 422);
}

// ── Insert into DB ───────────────────────────────────────────────────────────
$pdo = dolphin_db();

try {
    // Try with all columns (migration 007). Falls back through 005 → 004 → 003 → base.
    try {
        $stmt = $pdo->prepare(
            'INSERT INTO client_requests
               (name, company, email, phone, industry,
                is_india, gstin, legal_name, operating_name,
                org_type, is_msme, udyam_number, legal_address, website, logo_url)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
        );
        $stmt->execute([
            $name,
            $company,
            $email,
            $phone        ?: null,
            $industry     ?: null,
            $isIndia,
            $gstin        ?: null,
            $legalName    ?: null,
            $operatingName ?: null,
            $orgType      ?: null,
            $isMsme,
            $udyamNumber  ?: null,
            $legalAddress ?: null,
            $website      ?: null,
            $logoUrl      ?: null,
        ]);
    } catch (PDOException $colErr) {
        // logo_url column not yet applied — fall back to migration 005 (no logo_url).
        if (str_contains($colErr->getMessage(), 'Unknown column') || $colErr->getCode() === '42S22') {
            try {
                $stmt = $pdo->prepare(
                    'INSERT INTO client_requests
                       (name, company, email, phone, industry,
                        is_india, gstin, legal_name, operating_name,
                        org_type, is_msme, udyam_number, legal_address, website)
                     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
                );
                $stmt->execute([
                    $name, $company, $email,
                    $phone        ?: null,
                    $industry     ?: null,
                    $isIndia,
                    $gstin        ?: null,
                    $legalName    ?: null,
                    $operatingName ?: null,
                    $orgType      ?: null,
                    $isMsme,
                    $udyamNumber  ?: null,
                    $legalAddress ?: null,
                    $website      ?: null,
                ]);
            } catch (PDOException $e2) {
                // Last resort: base schema (no industry column)
                if (str_contains($e2->getMessage(), 'Unknown column') || $e2->getCode() === '42S22') {
                    $stmt = $pdo->prepare(
                        'INSERT INTO client_requests (name, company, email, phone)
                         VALUES (?,?,?,?)'
                    );
                    $stmt->execute([$name, $company, $email, $phone ?: null]);
                } else {
                    throw $e2;
                }
            }
        } else {
            throw $colErr;
        }
    }
} catch (PDOException $e) {
    // Duplicate email (23xxx) — return success to avoid info leak
    if (str_starts_with((string)$e->getCode(), '23')) {
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

        $row = fn($label, $val) =>
            "<tr><td style='padding:7px 0;color:#6b7280;width:140px;vertical-align:top'>{$label}</td>"
          . "<td style='padding:7px 0;font-weight:600'>" . htmlspecialchars((string)($val ?: '—')) . "</td></tr>";

        $notifyHtml = "
<html><body style='font-family:Arial,sans-serif;color:#1a1a1a;max-width:620px;margin:0 auto'>
  <div style='background:#1E6F5C;padding:24px 32px;border-radius:8px 8px 0 0'>
    <h2 style='color:#fff;margin:0;font-size:20px'>{$platformName}</h2>
    <p style='color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:14px'>New access request</p>
  </div>
  <div style='background:#f9fafb;padding:24px 32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px'>
    <p style='font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#1E6F5C;margin:0 0 10px'>Organisation</p>
    <table style='width:100%;border-collapse:collapse;font-size:13.5px'>
      {$row('Company', $company)}
      {$row('Legal name', $legalName)}
      {$row('Operating name', $operatingName)}
      {$row('Industry', $industry)}
      {$row('Org type', $orgType)}
      {$row('Registered in India', $isIndia ? 'Yes' : 'No')}
      {$row('GSTIN', $gstin)}
      {$row('MSME', $isMsme === null ? '—' : ($isMsme ? 'Yes' : 'No'))}
      {$row('Udyam No.', $udyamNumber)}
      {$row('Website', $website)}
    </table>
    <p style='font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#1E6F5C;margin:18px 0 6px'>Legal Address</p>
    <p style='font-size:13.5px;margin:0;white-space:pre-wrap'>" . htmlspecialchars($legalAddress ?: '—') . "</p>
    <p style='font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#1E6F5C;margin:18px 0 10px'>Primary Contact</p>
    <table style='width:100%;border-collapse:collapse;font-size:13.5px'>
      {$row('Name', $name)}
      {$row('Email', $email)}
      {$row('Phone', $phone)}
    </table>
    <div style='margin-top:20px;padding:12px 16px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;font-size:13px;color:#92400e'>
      Login credentials and status emails go to: <strong>" . htmlspecialchars($email) . "</strong>
    </div>
  </div>
</body></html>";

        $smtp->send($adminEmail, "New Access Request — " . htmlspecialchars($company), $notifyHtml);

        // Confirmation to requester
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
      We've received your request for <strong>" . htmlspecialchars($company) . "</strong>
      and our team will be in touch within <strong>2 business days</strong>.
    </p>
    <p style='font-size:14px;line-height:1.7;margin:0 0 24px'>
      We'll send your login credentials and next steps to this email address.
    </p>
    <p style='font-size:13px;color:#6b7280;margin:0'>— The Deepwoods Green Advisory team</p>
  </div>
</body></html>";

        $smtp->send($email, "We've received your request — {$platformName}", $confirmHtml);

    } catch (Throwable $e) {
        error_log('request-access email failed: ' . $e->getMessage());
    }
}

dolphin_send_json(['ok' => true, 'message' => 'Request received']);
