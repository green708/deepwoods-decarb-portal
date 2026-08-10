<?php
declare(strict_types=1);
require __DIR__ . '/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    dolphin_send_json(['error' => 'POST only'], 405);
}

$authUser = dolphin_require_auth();

$body     = dolphin_json_body();
$messages = $body['messages'] ?? [];
$model    = $body['model'] ?? 'llama-3.3-70b-versatile';

if (empty($messages) || !is_array($messages)) {
    dolphin_send_json(['error' => 'messages array required'], 400);
}

// Keys stored server-side — never shipped to the browser.
// Set GROQ_API_KEY_1..5 env vars on the server to override these defaults.
$keys = array_values(array_filter([
    getenv('GROQ_API_KEY_1') ?: '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',
    getenv('GROQ_API_KEY_2') ?: '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',
    getenv('GROQ_API_KEY_3') ?: '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',
    getenv('GROQ_API_KEY_4') ?: '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',
    getenv('GROQ_API_KEY_5') ?: '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',
]));

// Random key selection distributes rate-limit pressure across the pool.
$key = $keys[rand(0, count($keys) - 1)];

$ch = curl_init('https://api.groq.com/openai/v1/chat/completions');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_HTTPHEADER     => [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $key,
    ],
    CURLOPT_POSTFIELDS     => json_encode([
        'model'       => $model,
        'messages'    => $messages,
        'temperature' => 0.1,
        'max_tokens'  => 700,
    ]),
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_TIMEOUT        => 30,
]);

$response  = curl_exec($ch);
$httpCode  = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($response === false) {
    dolphin_send_json(['error' => 'AI service unreachable: ' . $curlError], 502);
}

http_response_code($httpCode);
header('Content-Type: application/json');
echo $response;
