<?php
declare(strict_types=1);

// Google Drive client authenticated as a real user (via OAuth refresh token)
// instead of a service account. Service accounts have no storage quota of
// their own on personal "My Drive" folders (only on Shared Drives, which
// require Google Workspace) — so for a plain Gmail-owned folder, uploads
// must happen as the real account. See backend/oauth-callback.php for how
// the refresh token gets created (one-time authorization).

class GoogleDrive {
    private string $clientId;
    private string $clientSecret;
    private string $refreshToken;
    private ?string $accessToken = null;

    public function __construct(string $clientId, string $clientSecret, string $tokenFilePath) {
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
        $this->clientId = $clientId;
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
