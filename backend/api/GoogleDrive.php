<?php
declare(strict_types=1);

// Google Drive client authenticated as a real user (via OAuth refresh token)
// instead of a service account. Service accounts have no storage quota of
// their own on personal "My Drive" folders (only on Shared Drives, which
// require Google Workspace) — so for a plain Gmail-owned folder, uploads
// must happen as the real account.
//
// Per-client flow: each client authorizes the portal once via drive-connect.php.
// Their refresh token is stored in clients.drive_refresh_token in the DB.
// Use GoogleDrive::fromToken() with the DB token for per-client uploads.
// The file-based constructor is kept for the legacy admin-level authorization.

class GoogleDrive {
    private string $clientId;
    private string $clientSecret;
    private string $refreshToken;
    private ?string $accessToken = null;

    // Per-client: build from a refresh token string stored in the DB.
    public static function fromToken(string $oauthClientId, string $oauthClientSecret, string $refreshToken): self {
        $instance = new self();
        $instance->clientId     = $oauthClientId;
        $instance->clientSecret = $oauthClientSecret;
        $instance->refreshToken = $refreshToken;
        return $instance;
    }

    // Legacy admin flow: build from a refresh token stored in a local JSON file.
    public function __construct(string $clientId = '', string $clientSecret = '', string $tokenFilePath = '') {
        if ($clientId === '' && $clientSecret === '' && $tokenFilePath === '') {
            // Called internally by fromToken() — properties set there.
            return;
        }
        if (!file_exists($tokenFilePath)) {
            throw new RuntimeException(
                "No Drive authorization found at $tokenFilePath — visit the authorization link " .
                "(see backend/oauth-callback.php) while logged into the Drive-owning Google account first."
            );
        }
        $tokenData = json_decode(file_get_contents($tokenFilePath), true);
        if (empty($tokenData['refresh_token'])) {
            throw new RuntimeException("$tokenFilePath exists but has no refresh_token in it.");
        }
        $this->clientId     = $clientId;
        $this->clientSecret = $clientSecret;
        $this->refreshToken = $tokenData['refresh_token'];
    }

    // Exchanges the long-lived refresh token for a short-lived access token.
    // Refresh tokens don't expire (unless revoked), so this "just works"
    // indefinitely once the one-time authorization has been done.
    private function getAccessToken(): string {
        if ($this->accessToken !== null) {
            return $this->accessToken;
        }

        $ch = curl_init('https://oauth2.googleapis.com/token');
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POSTFIELDS => http_build_query([
                'client_id' => $this->clientId,
                'client_secret' => $this->clientSecret,
                'refresh_token' => $this->refreshToken,
                'grant_type' => 'refresh_token',
            ]),
        ]);
        $response = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $data = json_decode($response, true);
        if ($status !== 200 || empty($data['access_token'])) {
            throw new RuntimeException('Failed to refresh Drive access token: ' . $response);
        }

        $this->accessToken = $data['access_token'];
        return $this->accessToken;
    }

    private function request(string $method, string $url, ?array $jsonBody = null): array {
        $ch = curl_init($url);
        $headers = ['Authorization: Bearer ' . $this->getAccessToken()];
        $opts = [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_RETURNTRANSFER => true,
        ];
        if ($jsonBody !== null) {
            $headers[] = 'Content-Type: application/json';
            $opts[CURLOPT_POSTFIELDS] = json_encode($jsonBody);
        }
        $opts[CURLOPT_HTTPHEADER] = $headers;
        curl_setopt_array($ch, $opts);
        $response = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $data = json_decode($response, true) ?? [];
        if ($status >= 300) {
            throw new RuntimeException("Drive API error ($status): $response");
        }
        return $data;
    }

    // Finds a folder named $name directly inside $parentId, creating it if it
    // doesn't exist yet. Used to mirror the FY/Scope folder structure.
    public function findOrCreateFolder(string $parentId, string $name): string {
        $q = sprintf(
            "'%s' in parents and name = '%s' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
            $parentId,
            str_replace("'", "\\'", $name)
        );
        $found = $this->request('GET', 'https://www.googleapis.com/drive/v3/files?' . http_build_query([
            'q' => $q,
            'fields' => 'files(id,name)',
        ]));
        if (!empty($found['files'])) {
            return $found['files'][0]['id'];
        }

        $created = $this->request('POST', 'https://www.googleapis.com/drive/v3/files', [
            'name' => $name,
            'mimeType' => 'application/vnd.google-apps.folder',
            'parents' => [$parentId],
        ]);
        return $created['id'];
    }

    // Find a Google Sheet named $name inside $parentId.
    // Creates it (with frozen header row) if not found.
    // Returns ['id' => sheetId, 'new' => bool].
    public function findOrCreateSheet(string $parentId, string $name): array {
        $q = sprintf(
            "'%s' in parents and name = '%s' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false",
            $parentId,
            str_replace("'", "\\'", $name)
        );
        $found = $this->request('GET', 'https://www.googleapis.com/drive/v3/files?' . http_build_query([
            'q'      => $q,
            'fields' => 'files(id)',
        ]));
        if (!empty($found['files'])) {
            return ['id' => $found['files'][0]['id'], 'new' => false];
        }

        $created = $this->request('POST', 'https://www.googleapis.com/drive/v3/files', [
            'name'     => $name,
            'mimeType' => 'application/vnd.google-apps.spreadsheet',
            'parents'  => [$parentId],
        ]);
        $sheetId = $created['id'];

        // Freeze the header row so it stays visible when scrolling.
        $this->request('POST', "https://sheets.googleapis.com/v4/spreadsheets/{$sheetId}:batchUpdate", [
            'requests' => [[
                'updateSheetProperties' => [
                    'properties' => ['sheetId' => 0, 'gridProperties' => ['frozenRowCount' => 1]],
                    'fields'     => 'gridProperties.frozenRowCount',
                ],
            ]],
        ]);

        return ['id' => $sheetId, 'new' => true];
    }

    // Read a range of cells from a sheet (returns array of row arrays).
    public function getSheetRows(string $spreadsheetId, string $range): array {
        $url = "https://sheets.googleapis.com/v4/spreadsheets/{$spreadsheetId}/values/" . urlencode($range);
        $result = $this->request('GET', $url);
        return $result['values'] ?? [];
    }

    // Overwrite a specific range with a single row of values.
    public function updateSheetRow(string $spreadsheetId, string $range, array $row): void {
        $url = "https://sheets.googleapis.com/v4/spreadsheets/{$spreadsheetId}/values/" . urlencode($range) . '?' . http_build_query([
            'valueInputOption' => 'USER_ENTERED',
        ]);
        $this->request('PUT', $url, ['values' => [$row]]);
    }

    // Append $rows (array of arrays) to the sheet.
    // Uses INSERT_ROWS so existing data is never overwritten.
    public function appendSheetRows(string $spreadsheetId, array $rows): void {
        $url = "https://sheets.googleapis.com/v4/spreadsheets/{$spreadsheetId}/values/A1:append?" . http_build_query([
            'valueInputOption' => 'USER_ENTERED',
            'insertDataOption' => 'INSERT_ROWS',
        ]);
        $this->request('POST', $url, ['values' => $rows]);
    }

    // Insert $rows immediately below the header row (row 2) so newest entries appear at the top.
    // Uses batchUpdate insertDimension to shift existing rows down, then writes the new data.
    public function prependSheetRows(string $spreadsheetId, array $rows): void {
        $count = count($rows);
        if ($count === 0) return;

        // Insert blank rows at index 1 (0-indexed) — right after the header.
        $this->request('POST', "https://sheets.googleapis.com/v4/spreadsheets/{$spreadsheetId}:batchUpdate", [
            'requests' => [[
                'insertDimension' => [
                    'range' => [
                        'sheetId'    => 0,
                        'dimension'  => 'ROWS',
                        'startIndex' => 1,
                        'endIndex'   => 1 + $count,
                    ],
                    'inheritFromBefore' => false,
                ],
            ]],
        ]);

        // Write new data into the newly created blank rows starting at A2.
        $url = "https://sheets.googleapis.com/v4/spreadsheets/{$spreadsheetId}/values/A2?" . http_build_query([
            'valueInputOption' => 'USER_ENTERED',
        ]);
        $this->request('PUT', $url, ['values' => $rows]);
    }

    // Uploads $localFilePath into $parentId, returns ['id' => ..., 'webViewLink' => ...].
    public function uploadFile(string $parentId, string $localFilePath, string $filename, string $mimeType): array {
        $metadata = json_encode(['name' => $filename, 'parents' => [$parentId]]);
        $boundary = 'dolphin-' . bin2hex(random_bytes(8));
        $fileContent = file_get_contents($localFilePath);

        $body = "--$boundary\r\n"
            . "Content-Type: application/json; charset=UTF-8\r\n\r\n"
            . "$metadata\r\n"
            . "--$boundary\r\n"
            . "Content-Type: $mimeType\r\n\r\n"
            . "$fileContent\r\n"
            . "--$boundary--";

        $ch = curl_init('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink');
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $this->getAccessToken(),
                "Content-Type: multipart/related; boundary=$boundary",
            ],
            CURLOPT_POSTFIELDS => $body,
        ]);
        $response = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $data = json_decode($response, true) ?? [];
        if ($status >= 300 || empty($data['id'])) {
            throw new RuntimeException("Drive upload failed ($status): $response");
        }
        return $data;
    }
}
