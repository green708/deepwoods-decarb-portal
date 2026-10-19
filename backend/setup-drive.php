<?php
declare(strict_types=1);
// setup-drive.php — One-time script to pre-create the Decarb Portal folder
// structure + Evidence Upload Log sheet for all clients in Google Drive.
//
// Visit:  https://yoursite.com/backend/setup-drive.php
// (while logged in as a Deepwoods admin — the Drive token must already exist)
//
// Safe to run multiple times: findOrCreateFolder / findOrCreateSheet are
// idempotent — they skip creation if the folder or sheet already exists.

require __DIR__ . '/api/db.php';
require __DIR__ . '/api/GoogleDrive.php';

header('Content-Type: text/plain; charset=utf-8');

$config = dolphin_config();

$driveClientId = $config['drive']['oauth_client_id'] ?? '';
if (!$driveClientId) {
    die("ERROR: drive.oauth_client_id is not set in config.php\n");
}

try {
    $drive = new GoogleDrive(
        $config['drive']['oauth_client_id'],
        $config['drive']['oauth_client_secret'],
        $config['drive']['token_path']
    );
} catch (Throwable $e) {
    die("ERROR: Could not initialise Drive client.\n" . $e->getMessage() . "\n\n"
        . "Have you completed the OAuth flow? Visit /backend/oauth-start.php first.\n");
}

// ── Clients to set up ─────────────────────────────────────────────────────────
// Pull from DB so this script stays generic (no hardcoded client names).
$pdo  = dolphin_db();
$stmt = $pdo->query(
    "SELECT id, name, drive_root_folder_id FROM clients
     WHERE drive_root_folder_id IS NOT NULL AND drive_root_folder_id != ''
     ORDER BY id"
);
$clients = $stmt->fetchAll(PDO::FETCH_ASSOC);

if (!$clients) {
    die("No clients have a drive_root_folder_id set.\n"
        . "Run the SQL UPDATE statements first:\n\n"
        . "  UPDATE clients SET drive_root_folder_id = '...' WHERE id = 17;\n"
        . "  UPDATE clients SET drive_root_folder_id = '...' WHERE id = 18;\n"
        . "  UPDATE clients SET drive_root_folder_id = '...' WHERE id = 20;\n");
}

echo "=== Decarb Portal Drive Setup ===\n\n";

foreach ($clients as $client) {
    $name   = $client['name'];
    $rootId = $client['drive_root_folder_id'];

    echo "── {$name} (id={$client['id']}) ──────────────────────────────\n";
    echo "   Root folder : {$rootId}\n";

    try {
        // 1. Decarb Portal folder
        $decarbId = $drive->findOrCreateFolder($rootId, 'Decarb Portal');
        echo "   Decarb Portal folder : {$decarbId}\n";

        // 2. Evidence Upload Log sheet (auto-inits frozen header on first create)
        $sheet = $drive->findOrCreateSheet($decarbId, 'Evidence Upload Log');
        $tag   = $sheet['new'] ? 'CREATED' : 'already exists';
        echo "   Evidence Upload Log  : {$sheet['id']} ({$tag})\n";

        // 3. If new sheet, write the header row
        if ($sheet['new']) {
            $drive->appendSheetRows($sheet['id'], [[
                'Timestamp', 'Entity', 'Year', 'Scope', 'Asset',
                'File Name', 'Kind', 'Drive Link', 'Uploaded By', 'Submission #',
            ]]);
            echo "   Header row written.\n";
        }

        echo "   OK\n\n";

    } catch (Throwable $e) {
        echo "   ERROR: " . $e->getMessage() . "\n\n";
    }
}

echo "Done. The folder structure is ready — subfolders (entity/year/scope/asset)\n";
echo "are created automatically the first time each file is uploaded.\n";
