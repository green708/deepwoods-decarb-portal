<?php
// lib_portal.php — helpers shared by the Deepwoods staff endpoints (admin/*), home-summary.php and cycle-submit.php.
declare(strict_types=1);

const CYCLE_STATUSES = ['open', 'submitted', 'locked'];
const CALC_STATUSES  = ['draft', 'calculated', 'verified', 'locked'];

/** Sends a JSON 400 with per-field messages. */
function dolphin_validation_failed(array $fields): void {
    dolphin_send_json(['error' => 'Validation failed', 'fields' => $fields], 400);
}

function dolphin_require_method(array $allowed): string {
    $m = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if (!in_array($m, $allowed, true)) dolphin_send_json(['error' => 'Method not allowed'], 405);
    return $m;
}

/** Positive client id from the query string or JSON body, else dies 400. Staff endpoints only. */
function dolphin_staff_client_id(?array $body = null): int {
    $raw = $body['client_id'] ?? $_GET['client_id'] ?? 0;
    $id = is_scalar($raw) ? (int)$raw : 0;
    if ($id <= 0) dolphin_send_json(['error' => 'client_id is required'], 400);
    return $id;
}

function dolphin_valid_fy(string $fy): bool {
    return (bool)preg_match('/^(FY\d{2}|FY\d{4}|CY\d{4})$/', $fy);
}

/** True for a real calendar date written as YYYY-MM-DD. */
function dolphin_valid_date($d): bool {
    if (!is_string($d) || !preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $d, $m)) return false;
    return checkdate((int)$m[2], (int)$m[3], (int)$m[1]);
}

/** Database "today" (session time zone) so due-date maths agrees with NOW() writes. */
function dolphin_today(): string {
    static $today = null;
    if ($today === null) {
        $today = (string)dolphin_db()->query('SELECT CURDATE()')->fetchColumn();
    }
    return $today;
}

/** Converts a DB timestamp ("Y-m-d H:i:s", session time zone) to ISO 8601 with the correct UTC offset. */
function dolphin_iso($ts): ?string {
    if ($ts === null || $ts === '' || strpos((string)$ts, '0000-00-00') === 0) return null;
    static $offset = null;
    if ($offset === null) {
        $mins = (int)dolphin_db()->query('SELECT TIMESTAMPDIFF(MINUTE, UTC_TIMESTAMP(), NOW())')->fetchColumn();
        $offset = sprintf('%s%02d:%02d', $mins < 0 ? '-' : '+', intdiv(abs($mins), 60), abs($mins) % 60);
    }
    return str_replace(' ', 'T', (string)$ts) . $offset;
}

/** Non-consolidated entities of a client, in display order: [ ['code'=>, 'name'=>], ... ]. */
function dolphin_reporting_entities(PDO $pdo, int $clientId): array {
    $st = $pdo->prepare('SELECT code, name FROM client_entities WHERE client_id = ? AND is_consolidated = 0 ORDER BY sort_order, id');
    $st->execute([$clientId]);
    return $st->fetchAll();
}

/**
 * Collapses per-entity cycle rows into one cycle summary.
 * Each row: status|null, data_due_date, report_due_date, submitted_at, submitted_by (null status = virtual open).
 * Returns status 'none' when there are no rows; callers map that as they need.
 * The due dates reported are those of entities still open; when everything is submitted the earliest overall.
 */
function dolphin_agg_cycle(array $rows, string $today): array {
    $out = [
        'status' => 'none', 'data_due_date' => null, 'report_due_date' => null,
        'submitted_at' => null, 'submitted_by' => null, 'days_to_due' => null, 'overdue' => false,
        'submitted_entities' => 0, 'entities' => count($rows),
    ];
    if (!$rows) return $out;

    $open = 0; $done = 0; $locked = 0; $overdue = false;
    $dueOpen = []; $dueAll = []; $repOpen = []; $repAll = [];
    $lastSubAt = null; $lastSubBy = null;
    foreach ($rows as $r) {
        $st  = $r['status'] ?: 'open';
        $due = $r['data_due_date'] ?: null;
        $rep = $r['report_due_date'] ?: null;
        if ($due) $dueAll[] = $due;
        if ($rep) $repAll[] = $rep;
        if ($st === 'open') {
            $open++;
            if ($due) { $dueOpen[] = $due; if ($due < $today) $overdue = true; }
            if ($rep) $repOpen[] = $rep;
        } else {
            $done++;
            if ($st === 'locked') $locked++;
            if (!empty($r['submitted_at']) && ($lastSubAt === null || $r['submitted_at'] > $lastSubAt)) {
                $lastSubAt = $r['submitted_at'];
                $lastSubBy = $r['submitted_by'] ?? null;
            }
        }
    }
    $out['status'] = $open > 0 ? 'open' : ($locked === $done ? 'locked' : 'submitted');
    $out['overdue'] = $overdue;
    $out['submitted_entities'] = $done;
    $d = $dueOpen ?: $dueAll;
    $p = $repOpen ?: $repAll;
    $out['data_due_date'] = $d ? min($d) : null;
    $out['report_due_date'] = $p ? min($p) : null;
    if ($out['status'] !== 'open') {
        $out['submitted_at'] = dolphin_iso($lastSubAt);
        $out['submitted_by'] = $lastSubBy;
    }
    if ($out['data_due_date'] !== null) {
        $out['days_to_due'] = (int)(new DateTimeImmutable($today))->diff(new DateTimeImmutable($out['data_due_date']))->format('%r%a');
    }
    return $out;
}

/**
 * Collapses per-entity calc rows into the lowest status. Each row: status|null (null = virtual draft),
 * calculated_at, verified_at, ef_version. Returns status 'none' when there are no rows.
 */
function dolphin_agg_calc(array $rows): array {
    $out = ['status' => 'none', 'calculated_at' => null, 'verified_at' => null, 'ef_version' => null, 'to_verify' => 0];
    if (!$rows) return $out;
    $rank = array_flip(CALC_STATUSES);
    $low = 99; $calcAt = null; $verAt = null; $ef = null; $toVerify = 0;
    foreach ($rows as $r) {
        $st = $r['status'] ?: 'draft';
        if ($rank[$st] < $low) $low = $rank[$st];
        if ($st === 'calculated') $toVerify++;
        if (!empty($r['calculated_at']) && ($calcAt === null || $r['calculated_at'] > $calcAt)) $calcAt = $r['calculated_at'];
        if (!empty($r['verified_at']) && ($verAt === null || $r['verified_at'] > $verAt)) $verAt = $r['verified_at'];
    }
    foreach ($rows as $r) {
        if (($r['status'] ?: 'draft') === CALC_STATUSES[$low] && !empty($r['ef_version'])) { $ef = $r['ef_version']; break; }
    }
    $out['status'] = CALC_STATUSES[$low];
    $out['calculated_at'] = $low >= 1 ? dolphin_iso($calcAt) : null;
    $out['verified_at'] = $low >= 2 ? dolphin_iso($verAt) : null;
    $out['ef_version'] = $ef;
    $out['to_verify'] = $toVerify;
    return $out;
}

/** client_config value, unwrapping a JSON-encoded string if that is how it was stored. */
function dolphin_cfg_str(array $config, string $key): ?string {
    if (!isset($config[$key])) return null;
    $v = trim((string)$config[$key]);
    if ($v === '') return null;
    if (strlen($v) >= 2 && $v[0] === '"' && substr($v, -1) === '"') {
        $d = json_decode($v, true);
        if (is_string($d)) $v = trim($d);
    }
    return $v === '' ? null : $v;
}

/** Best-effort email to all Deepwoods staff. Silently does nothing when SMTP is not configured. */
function dolphin_notify_staff(PDO $pdo, string $subject, string $htmlBody): void {
    try {
        $cfg = dolphin_config();
        $smtpCfg = $cfg['smtp'] ?? [];
        if (empty($smtpCfg['host']) || empty($smtpCfg['username']) || empty($smtpCfg['app_password'])) return;
        require_once __DIR__ . '/Smtp.php';

        $to = $pdo->query("SELECT email FROM users WHERE role IN ('deepwoods_admin','deepwoods_coordinator') AND client_id IS NULL")
                  ->fetchAll(PDO::FETCH_COLUMN);
        $extra = $cfg['dw_notification_emails'] ?? [];
        if (is_string($extra)) $extra = [$extra];
        foreach ($extra as $e) {
            if (filter_var($e, FILTER_VALIDATE_EMAIL) && !in_array($e, $to, true)) $to[] = $e;
        }
        if (!$to && !empty($cfg['admin_email'])) $to[] = $cfg['admin_email'];
        if (!$to) return;

        $cc = [];
        $test = $cfg['notification_test_email'] ?? '';
        if ($test && !in_array($test, $to, true)) $cc[] = $test;

        $smtp = new Smtp(
            $smtpCfg['host'],
            (int)($smtpCfg['port'] ?? 587),
            $smtpCfg['username'],
            $smtpCfg['app_password'],
            $smtpCfg['from_email'] ?? $smtpCfg['username'],
            $smtpCfg['from_name'] ?? 'Deepwoods Decarbonisation Portal'
        );
        $smtp->send($to, $subject, $htmlBody, $cc);
    } catch (Throwable $e) {
        error_log('dolphin_notify_staff failed: ' . $e->getMessage());
    }
}
