<?php
declare(strict_types=1);
require __DIR__ . '/db.php';
require __DIR__ . '/GoogleDrive.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    dolphin_send_json(['error' => 'POST only'], 405);
}

$authUser = dolphin_require_auth();
dolphin_require_active_client($authUser);
dolphin_require_payment($authUser);

$pdo    = dolphin_db();
$config = dolphin_config();

$clientId    = (int)$authUser['client_id']; // from the session — never caller-supplied
$version     = $_POST['version'] ?? 'V1';
$datasetId   = $_POST['dataset_id'] ?? '';
$datasetName = $_POST['dataset_name'] ?? '';
$tag         = $_POST['tag'] ?? '';
$year        = $_POST['year'] ?? '';
$unit        = $_POST['unit'] ?? 'Organisation-wide';
$notes       = $_POST['notes'] ?? '';
$submittedBy = $authUser['email']; // from the session, not client-supplied

if ($datasetId === '' || $year === '') {
    dolphin_send_json(['error' => 'dataset_id and year are required'], 400);
}

// Entity: enforce entity_scope first, then verify ownership.
// This prevents a scoped user (entity_scope=FP) from submitting as another entity.
$entity = dolphin_validate_entity($authUser, strtoupper($_POST['entity'] ?? ''));
if ($entity === '') {
    dolphin_send_json(['error' => 'entity is required'], 400);
}

// Validate entity exists for this client and is not a consolidated view.
$entityStmt = $pdo->prepare(
    'SELECT code, is_consolidated FROM client_entities WHERE client_id = ? AND code = ?'
);
$entityStmt->execute([$clientId, $entity]);
$entityRow = $entityStmt->fetch();
if (!$entityRow) {
    dolphin_send_json(['error' => "Unknown entity: $entity"], 400);
}
if ((bool) $entityRow['is_consolidated']) {
    dolphin_send_json(['error' => 'Consolidated entities cannot receive submissions'], 400);
}

// Get drive root folder from clients table via authenticated client_id.
$clientStmt = $pdo->prepare('SELECT drive_root_folder_id FROM clients WHERE id = ?');
$clientStmt->execute([$clientId]);
$clientRow = $clientStmt->fetch();
if (!$clientRow) {
    dolphin_send_json(['error' => 'Client not found'], 500);
}

// Insert the submission row first so we have an id, even if a file upload
// fails partway through — the record still exists and can be retried/fixed.
$stmt = $pdo->prepare(
    'INSERT INTO submissions (client_id, entity, version, dataset_id, dataset_name, tag, year, unit, notes, submitted_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
);
$stmt->execute([$clientId, $entity, $version, $datasetId, $datasetName, $tag, $year, $unit, $notes, $submittedBy]);
$submissionId = (int) $pdo->lastInsertId();

$fileRows = [];

// Drive upload is optional — skip if credentials are not configured.
$driveClientId = $config['drive']['oauth_client_id'] ?? '';
if ($driveClientId !== '') {
    try {
        $drive = new GoogleDrive(
            $config['drive']['oauth_client_id'],
            $config['drive']['oauth_client_secret'],
            $config['drive']['token_path']
        );

        // Mirror structure: <client root>/<entity>/<year>/Portal Uploads/<dataset name>/
        $entityFolder = $drive->findOrCreateFolder($clientRow['drive_root_folder_id'], $entity);
        $yearFolder   = $drive->findOrCreateFolder($entityFolder, $year);
        $portalFolder = $drive->findOrCreateFolder($yearFolder, 'Portal Uploads');
        $datasetFolder = $drive->findOrCreateFolder($portalFolder, $datasetName !== '' ? $datasetName : $datasetId);

        $insertFile = $pdo->prepare(
            'INSERT INTO submission_files (submission_id, original_name, drive_file_id, drive_file_link, kind) VALUES (?, ?, ?, ?, ?)'
        );

        // Main data file — sent as $_FILES['dataFile'] (single file field)
        if (!empty($_FILES['dataFile']['tmp_name'])) {
            $f = $_FILES['dataFile'];
            $uploaded = $drive->uploadFile($datasetFolder, $f['tmp_name'], $f['name'], $f['type'] ?: 'application/octet-stream');
            $insertFile->execute([$submissionId, $f['name'], $uploaded['id'], $uploaded['webViewLink'], 'data']);
            $fileRows[] = ['name' => $f['name'], 'driveLink' => $uploaded['webViewLink'], 'kind' => 'data'];
        }

        // Supporting documents — sent as $_FILES['documents'][] (multiple file field)
        if (!empty($_FILES['documents']['tmp_name']) && is_array($_FILES['documents']['tmp_name'])) {
            foreach ($_FILES['documents']['tmp_name'] as $i => $tmpName) {
                if ($tmpName === '') continue;
                $name = $_FILES['documents']['name'][$i];
                $type = $_FILES['documents']['type'][$i] ?: 'application/octet-stream';
                $uploaded = $drive->uploadFile($datasetFolder, $tmpName, $name, $type);
                $insertFile->execute([$submissionId, $name, $uploaded['id'], $uploaded['webViewLink'], 'document']);
                $fileRows[] = ['name' => $name, 'driveLink' => $uploaded['webViewLink'], 'kind' => 'document'];
            }
        }
    } catch (Throwable $e) {
        // Submission record is safe in the DB — only Drive upload failed.
        // Return 200 with a drive_warning so the frontend can show a soft alert
        // rather than treating the whole submission as failed.
        error_log('submit.php Drive upload failed for submission #' . $submissionId . ': ' . $e->getMessage());
        dolphin_send_json([
            'id'           => $submissionId,
            'entity'       => $entity,
            'version'      => $version,
            'datasetId'    => $datasetId,
            'datasetName'  => $datasetName,
            'tag'          => $tag,
            'year'         => $year,
            'unit'         => $unit,
            'notes'        => $notes,
            'status'       => 'Pending',
            'submittedBy'  => $submittedBy,
            'files'        => [],
            'drive_warning' => 'File upload to Drive failed — submission recorded, files will need to be uploaded manually.',
        ]);
    }
}

dolphin_send_json([
    'id'          => $submissionId,
    'entity'      => $entity,
    'version'     => $version,
    'datasetId'   => $datasetId,
    'datasetName' => $datasetName,
    'tag'         => $tag,
    'year'        => $year,
    'unit'        => $unit,
    'notes'       => $notes,
    'status'      => 'Pending',
    'submittedBy' => $submittedBy,
    'files'       => $fileRows,
]);
