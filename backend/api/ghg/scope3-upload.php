<?php
declare(strict_types=1);
require __DIR__ . '/../db.php';
require __DIR__ . '/../GoogleDrive.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    dolphin_send_json(['error' => 'POST only'], 405);
}

$authUser = dolphin_require_auth();
dolphin_block_read_only_writes($authUser);
dolphin_require_active_client($authUser);
dolphin_require_payment($authUser);

$pdo    = dolphin_db();
$config = dolphin_config();

$clientId    = (int)$authUser['client_id'];
$submittedBy = $authUser['email'];

$categoryId          = $_POST['category_id'] ?? '';
$categoryName        = $_POST['category_name'] ?? '';
$year                = $_POST['year'] ?? '';
$entity              = dolphin_validate_entity($authUser, strtoupper($_POST['entity'] ?? ''));
$facilityScope       = trim($_POST['facility_scope'] ?? 'All Facilities');
$reportingFrequency  = $_POST['reporting_frequency'] ?? 'yearly';
$period              = trim($_POST['period'] ?? '');

if ($facilityScope === '') $facilityScope = 'All Facilities';

if ($categoryId === '' || $year === '' || $entity === '') {
    dolphin_send_json(['error' => 'category_id, entity, and year are required'], 400);
}

// Validate entity exists for this client and is not consolidated.
$entityStmt = $pdo->prepare(
    'SELECT code FROM client_entities WHERE client_id = ? AND code = ? AND is_consolidated = 0'
);
$entityStmt->execute([$clientId, $entity]);
if (!$entityStmt->fetch()) {
    dolphin_send_json(['error' => "Unknown or consolidated entity: $entity"], 400);
}

// Get drive credentials from clients table (via authenticated client_id — never caller-supplied).
$clientStmt = $pdo->prepare('SELECT drive_root_folder_id, drive_refresh_token FROM clients WHERE id = ?');
$clientStmt->execute([$clientId]);
$clientRow = $clientStmt->fetch();
if (!$clientRow) {
    dolphin_send_json(['error' => 'Client not found'], 500);
}

$fileRows     = [];
$driveWarning = null;
$driveLogWarning = null;
$driveFolderPath = null;

$driveClientId     = $config['drive']['oauth_client_id'] ?? '';
$driveRootFolderId = $clientRow['drive_root_folder_id'] ?? '';
$clientRefreshToken = $clientRow['drive_refresh_token'] ?? '';

// Prefer the per-client refresh token; fall back to the legacy shared token file
// (used when the client hasn't connected their Drive yet).
$driveReady = $driveClientId !== '' && $driveRootFolderId !== '';

if ($driveReady) {
    try {
        if ($clientRefreshToken !== '') {
            // Per-client OAuth: use the token stored in the DB for this client's account.
            $drive = GoogleDrive::fromToken(
                $config['drive']['oauth_client_id'],
                $config['drive']['oauth_client_secret'],
                $clientRefreshToken
            );
        } else {
            // Legacy fallback: shared admin token file (only works if the admin's account
            // has access to this client's Drive folder — requires the folder to be shared).
            $drive = new GoogleDrive(
                $config['drive']['oauth_client_id'],
                $config['drive']['oauth_client_secret'],
                $config['drive']['token_path']
            );
        }

        // Folder: <client root>/Decarb Portal/<entity>/<facility>/<year>/Scope 3/<Category N: Name>/[<period>/]
        preg_match('/\d+/', $categoryId, $catNumMatch);
        $catNum        = isset($catNumMatch[0]) ? 'Category ' . $catNumMatch[0] : strtoupper($categoryId);
        $catLabel      = $catNum . ($categoryName !== '' ? ': ' . $categoryName : '');
        $decarbFolder  = $drive->findOrCreateFolder($driveRootFolderId, 'Decarb Portal');
        $entityFolder  = $drive->findOrCreateFolder($decarbFolder, $entity);
        $facilityFolder = $drive->findOrCreateFolder($entityFolder, $facilityScope);
        $yearFolder    = $drive->findOrCreateFolder($facilityFolder, $year);
        $scope3Folder  = $drive->findOrCreateFolder($yearFolder, 'Scope 3');
        $catFolder     = $drive->findOrCreateFolder($scope3Folder, $catLabel);
        if ($period !== '') {
            $catFolder = $drive->findOrCreateFolder($catFolder, $period);
            $driveFolderPath = "Decarb Portal/$entity/$facilityScope/$year/Scope 3/$catLabel/$period";
        } else {
            $driveFolderPath = "Decarb Portal/$entity/$facilityScope/$year/Scope 3/$catLabel";
        }

        $logRows = [];

        // Multiple files sent as $_FILES['files'][]
        if (!empty($_FILES['files']['tmp_name']) && is_array($_FILES['files']['tmp_name'])) {
            foreach ($_FILES['files']['tmp_name'] as $i => $tmpName) {
                if ($tmpName === '') continue;
                $name     = $_FILES['files']['name'][$i];
                $type     = $_FILES['files']['type'][$i] ?: 'application/octet-stream';
                $uploaded = $drive->uploadFile($catFolder, $tmpName, $name, $type);
                $fileRows[] = ['name' => $name, 'driveLink' => $uploaded['webViewLink']];
                $logRows[]  = [
                    date('Y-m-d H:i:s'), $entity, $facilityScope, $year, 'Scope 3',
                    $catLabel, $reportingFrequency, $period ?: '-',
                    $name, 'data', $uploaded['webViewLink'], $submittedBy, '-',
                ];
            }
        }

        if (!empty($logRows)) {
            try {
                $expectedHeader = [
                    'Timestamp', 'Entity', 'Facility', 'Year', 'Scope', 'Category',
                    'Reporting Frequency', 'Period',
                    'File Name', 'Kind', 'Drive Link', 'Uploaded By', 'Submission #',
                ];
                $logSheet = $drive->findOrCreateSheet($decarbFolder, 'Evidence Upload Log');
                if ($logSheet['new']) {
                    $drive->appendSheetRows($logSheet['id'], [$expectedHeader]);
                } else {
                    // Auto-fix stale header (sheet existed before Facility/Period columns were added).
                    $existing = $drive->getSheetRows($logSheet['id'], 'A1:M1');
                    if (empty($existing) || $existing[0] !== $expectedHeader) {
                        $drive->updateSheetRow($logSheet['id'], 'A1:M1', $expectedHeader);
                    }
                }
                $drive->prependSheetRows($logSheet['id'], $logRows);
            } catch (Throwable $logErr) {
                error_log('scope3-upload.php sheet log failed: ' . $logErr->getMessage());
                $driveLogWarning = 'File uploaded to Drive but log entry failed: ' . $logErr->getMessage();
            }
        }
    } catch (Throwable $e) {
        error_log('scope3-upload.php Drive upload failed: ' . $e->getMessage());
        $driveWarning = 'File upload to Drive failed: ' . $e->getMessage();
    }
} elseif ($driveClientId === '') {
    $driveWarning = 'Drive not configured (oauth_client_id missing from config).';
} elseif ($driveRootFolderId === '') {
    $driveWarning = 'Drive not connected yet — please connect your Google Drive from the portal settings before uploading.';
}

$response = ['files' => $fileRows];
if ($driveFolderPath !== null) {
    $response['drive_folder'] = $driveFolderPath;
}
if ($driveWarning !== null) {
    $response['drive_warning'] = $driveWarning;
}
if ($driveLogWarning !== null) {
    $response['log_warning'] = $driveLogWarning;
}
dolphin_send_json($response);
