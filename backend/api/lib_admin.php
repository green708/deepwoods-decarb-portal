<?php
// lib_admin.php — shared helpers for Deepwoods-staff endpoints and the client Home summary.
declare(strict_types=1);

const DW_ROLES = ['deepwoods_admin', 'deepwoods_coordinator'];

/** Allowed lifecycle statuses for decarb_actions.status (matches the Progress page labels). */
const ACTION_STATUSES = ['Idea', 'Planned', 'Committed', 'In Progress', 'Completed', 'Delayed', 'Cancelled'];

/** client_config keys Deepwoods staff may edit, with their validation type. */
const CLIENT_SETTING_KEYS = [
    'base_year_s12'       => 'fy_label',
    'base_year_s3'        => 'fy_label',
    'sbti_target_s12'     => 'percent',
    'sbti_target_s3'      => 'percent',
    'sbti_target_year'    => 'year',
    'netzero_year'        => 'year',
    'target_basis'        => 'basis',
    'residual_strategy'   => 'text',
    'renewable_target_pct'=> 'percent',
    'consultant_name'     => 'short',
    'consultant_email'    => 'email',
    'consultant_phone'    => 'short',
    'support_email'       => 'email',
    'current_fy'          => 'fy_label',
];

/** Dies 403 unless the caller is Deepwoods staff. $adminOnly restricts to deepwoods_admin. */
function dolphin_require_deepwoods(array $user, bool $adminOnly = false): void {
    $allowed = $adminOnly ? ['deepwoods_admin'] : DW_ROLES;
    if (!in_array($user['role'] ?? '', $allowed, true)) {
        dolphin_send_json(['error' => 'Not authorised'], 403);
    }
}

/** Appends to the staff activity trail. Never throws. */
function dolphin_log_activity(PDO $pdo, ?int $clientId, string $actor, string $action, ?string $detail = null): void {
    try {
        $pdo->prepare('INSERT INTO admin_activity (client_id, actor, action, detail) VALUES (?, ?, ?, ?)')
            ->execute([$clientId, $actor, $action, $detail]);
    } catch (Throwable $e) {
        error_log('dolphin_log_activity failed: ' . $e->getMessage());
    }
}

/** Returns the clients row or dies 404. */
function dolphin_client_or_404(PDO $pdo, int $clientId): array {
    $st = $pdo->prepare('SELECT * FROM clients WHERE id = ?');
    $st->execute([$clientId]);
    $row = $st->fetch();
    if (!$row) dolphin_send_json(['error' => 'Client not found'], 404);
    return $row;
}

/** client_config as a key => value map. */
function dolphin_client_config(PDO $pdo, int $clientId): array {
    $st = $pdo->prepare('SELECT config_key, config_value FROM client_config WHERE client_id = ?');
    $st->execute([$clientId]);
    $out = [];
    foreach ($st->fetchAll() as $r) $out[$r['config_key']] = $r['config_value'];
    return $out;
}

/**
 * The reporting year a client is currently reporting on = the LAST COMPLETED year.
 * CY clients: today in 2026 -> "CY2025". FY clients with start month S: the most recent FY whose
 * last month has already ended, labelled by the year it ends, e.g. S=4 and today = Oct 2026 ->
 * FY26 (Apr-25..Mar-26), matching the portal's genMonths() convention.
 */
function dolphin_current_fy(string $reportingPeriod, int $startMonth, ?DateTimeInterface $now = null): string {
    $now = $now ?? new DateTimeImmutable('now');
    $year = (int)$now->format('Y');
    $month = (int)$now->format('n');
    if ($reportingPeriod === 'CY') return 'CY' . ($year - 1);
    if ($startMonth < 1 || $startMonth > 12) $startMonth = 4;
    if ($startMonth === 1) return 'FY' . substr((string)($year - 1), -2);
    $endYear = $month >= $startMonth ? $year : $year - 1;
    return 'FY' . substr((string)$endYear, -2);
}

/** Fiscal year to treat as "current" for a client (config override wins). */
function dolphin_client_fy(array $client, array $config): string {
    if (!empty($config['current_fy'])) return (string)$config['current_fy'];
    $period = (string)($client['reporting_period'] ?? 'FY');
    $start  = $period === 'CY' ? 1 : (int)($config['fiscal_year_start_month'] ?? 4);
    return dolphin_current_fy($period, $start);
}

/** Validates one client setting. Returns the normalised string, null to clear, or throws InvalidArgumentException. */
function dolphin_validate_setting(string $type, $raw): ?string {
    if ($raw === null) return null;
    $v = trim((string)$raw);
    if ($v === '') return null;
    switch ($type) {
        case 'percent':
            if (!is_numeric($v) || (float)$v < 0 || (float)$v > 100) throw new InvalidArgumentException('must be a number between 0 and 100');
            return rtrim(rtrim(number_format((float)$v, 2, '.', ''), '0'), '.');
        case 'year':
            if (!ctype_digit($v) || (int)$v < 2000 || (int)$v > 2100) throw new InvalidArgumentException('must be a year between 2000 and 2100');
            return $v;
        case 'fy_label':
            if (!preg_match('/^(FY\d{2}|FY\d{4}|CY\d{4})$/', $v)) throw new InvalidArgumentException('must look like FY26 or CY2025');
            return $v;
        case 'basis':
            if (!in_array($v, ['market', 'location'], true)) throw new InvalidArgumentException("must be 'market' or 'location'");
            return $v;
        case 'email':
            if (!filter_var($v, FILTER_VALIDATE_EMAIL)) throw new InvalidArgumentException('must be a valid email address');
            return strtolower($v);
        case 'short':
            if (mb_strlen($v) > 120) throw new InvalidArgumentException('too long (max 120 characters)');
            return $v;
        case 'text':
            if (mb_strlen($v) > 2000) throw new InvalidArgumentException('too long (max 2000 characters)');
            return $v;
    }
    throw new InvalidArgumentException('unknown setting type');
}
