<?php
/**
 * ghg-proxy.php — GHG Apps Script CORS proxy
 *
 * DEPLOYMENT: Upload this file to Hostinger public_html/ alongside dist-static/.
 * It does NOT live inside dist-static/ — deploy it separately every time the
 * Apps Script URL changes. See docs/DEPLOYMENT_GUIDE.md.
 *
 * The React portal calls this file instead of Apps Script directly.
 * This script forwards the request server-side — no CORS restriction.
 *
 * To configure: either hardcode GHG_APPS_SCRIPT_URL below, or add
 *   define('GHG_APPS_SCRIPT_URL', 'https://...') to backend/config.php.
 */

// Allow override from backend/config.php if already loaded
if (!defined('GHG_APPS_SCRIPT_URL') && file_exists(__DIR__ . '/backend/config.php')) {
    $cfg = require __DIR__ . '/backend/config.php';
    if (!empty($cfg['ghg_webapp_url'])) {
        define('GHG_APPS_SCRIPT_URL', $cfg['ghg_webapp_url']);
    }
}
if (!defined('GHG_APPS_SCRIPT_URL')) {
    // Fallback: set your Apps Script URL here
    define('GHG_APPS_SCRIPT_URL', 'REPLACE_WITH_APPS_SCRIPT_URL');
}

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

// Handle browser preflight
if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit;
}

$APPS_SCRIPT_URL = GHG_APPS_SCRIPT_URL;

function make_curl($url) {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    // Force HTTP/1.1 — Google's redirect chain breaks HTTP/2 on some hosts
    curl_setopt($ch, CURLOPT_HTTP_VERSION, CURL_HTTP_VERSION_1_1);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
    $ca_paths = [
        "/etc/ssl/certs/ca-certificates.crt",
        "/etc/pki/tls/certs/ca-bundle.crt",
        "/usr/share/ca-certificates/cacert.pem",
    ];
    foreach ($ca_paths as $p) {
        if (file_exists($p)) { curl_setopt($ch, CURLOPT_CAINFO, $p); break; }
    }
    return $ch;
}

if ($_SERVER["REQUEST_METHOD"] === "GET") {
    $qs  = $_SERVER["QUERY_STRING"] ? "?" . $_SERVER["QUERY_STRING"] : "";
    $url = $APPS_SCRIPT_URL . $qs;

    $ch = make_curl($url);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    $response = curl_exec($ch);
    $code     = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err      = curl_error($ch);
    $errno    = curl_errno($ch);
    curl_close($ch);

    if ($err) {
        http_response_code(500);
        echo json_encode(["error" => $err, "errno" => $errno]);
        exit;
    }
    http_response_code($code);
    echo $response;

} elseif ($_SERVER["REQUEST_METHOD"] === "POST") {
    $body    = file_get_contents("php://input");
    $hdrs    = ["Content-Type: application/json", "Content-Length: " . strlen($body)];

    // Step 1 — POST to exec URL; capture the redirect without following it.
    // Apps Script exec always returns 302 → script.googleusercontent.com/echo?...
    $ch = make_curl($APPS_SCRIPT_URL);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, false); // override make_curl default
    curl_setopt($ch, CURLOPT_HEADER, true);           // include response headers in output
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $hdrs);
    $raw   = curl_exec($ch);
    $hSz   = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $code  = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err   = curl_error($ch);
    $errno = curl_errno($ch);
    curl_close($ch);

    if ($err) {
        http_response_code(500);
        echo json_encode(["error" => $err, "errno" => $errno]);
        exit;
    }

    $response = substr($raw, $hSz);

    // Step 2 — if redirect, GET the Location (echo URL).
    // Apps Script exec runs the script on step 1 and encodes the result in the
    // redirect URL; the echo URL is a stateless GET-only response server.
    if ($code >= 300 && $code < 400) {
        $rawHeaders = substr($raw, 0, $hSz);
        preg_match('/^Location:\s*(.+)$/mi', $rawHeaders, $m);
        $loc = isset($m[1]) ? trim($m[1]) : null;
        if ($loc) {
            $ch2 = make_curl($loc);  // make_curl sets FOLLOWLOCATION=true (GET chain)
            curl_setopt($ch2, CURLOPT_TIMEOUT, 30);
            // GET — no CURLOPT_POST; echo URL only accepts GET
            $response = curl_exec($ch2);
            $code     = curl_getinfo($ch2, CURLINFO_HTTP_CODE);
            $err      = curl_error($ch2);
            $errno    = curl_errno($ch2);
            curl_close($ch2);
            if ($err) {
                http_response_code(500);
                echo json_encode(["error" => $err, "errno" => $errno]);
                exit;
            }
        }
    }

    http_response_code($code);
    echo $response;

} else {
    http_response_code(405);
    echo json_encode(["error" => "Method not allowed"]);
}
