<?php
// Minimal SMTP client using plain sockets — no external library. Sends mail
// via Gmail's SMTP relay (smtp.gmail.com:587, STARTTLS, AUTH LOGIN) using an
// account + App Password. Same "no Composer needed" approach as GoogleDrive.php.

class Smtp {
    private string $host;
    private int $port;
    private string $username;
    private string $password;
    private string $fromEmail;
    private string $fromName;

    public function __construct(
        string $host,
        int $port,
        string $username,
        string $password,
        string $fromEmail,
        string $fromName = 'Deepwoods Decarbonisation Portal'
    ) {
        $this->host      = $host;
        $this->port      = $port;
        $this->username  = $username;
        $this->password  = $password;
        $this->fromEmail = $fromEmail;
        $this->fromName  = $fromName;
    }

    /**
     * Send an email.
     *
     * @param string|string[] $to      One or more primary recipients (all appear in the To: header)
     * @param string          $subject Email subject
     * @param string          $htmlBody HTML body
     * @param string[]        $cc      Zero or more CC addresses (appear in the CC: header)
     */
    public function send(string|array $to, string $subject, string $htmlBody, array $cc = []): void {
        $toList = is_array($to) ? array_values(array_filter($to)) : [$to];
        $socket = fsockopen($this->host, $this->port, $errno, $errstr, 15);
        if (!$socket) {
            throw new RuntimeException("Could not connect to SMTP server: $errstr ($errno)");
        }

        try {
            $this->expect($socket, 220);
            $this->command($socket, "EHLO ghgportal.local", 250);
            $this->command($socket, "STARTTLS", 220);

            if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                throw new RuntimeException("STARTTLS negotiation failed");
            }

            $this->command($socket, "EHLO ghgportal.local", 250);
            $this->command($socket, "AUTH LOGIN", 334);
            $this->command($socket, base64_encode($this->username), 334);
            $this->command($socket, base64_encode($this->password), 235);

            $this->command($socket, "MAIL FROM: <{$this->fromEmail}>", 250);
            foreach ($toList as $addr) {
                if (filter_var($addr, FILTER_VALIDATE_EMAIL)) {
                    $this->command($socket, "RCPT TO: <{$addr}>", 250);
                }
            }
            foreach ($cc as $ccAddr) {
                if (filter_var($ccAddr, FILTER_VALIDATE_EMAIL)) {
                    $this->command($socket, "RCPT TO: <{$ccAddr}>", 250);
                }
            }
            $this->command($socket, "DATA", 354);

            // SMTP dot-stuffing: any line starting with "." must be escaped.
            $safeBody = preg_replace('/^\./m', '..', $htmlBody);

            $toHeader = implode(', ', array_map(fn($a) => "<{$a}>", $toList));
            $headers  = "From: {$this->fromName} <{$this->fromEmail}>\r\n";
            $headers .= "Reply-To: <{$this->fromEmail}>\r\n";
            $headers .= "To: {$toHeader}\r\n";
            if (!empty($cc)) {
                $ccList   = implode(', ', array_map(fn($a) => "<{$a}>", $cc));
                $headers .= "CC: {$ccList}\r\n";
            }
            $headers .= "Subject: {$subject}\r\n";
            $headers .= "MIME-Version: 1.0\r\n";
            $headers .= "Content-Type: text/html; charset=UTF-8\r\n";

            fwrite($socket, $headers . "\r\n" . $safeBody . "\r\n.\r\n");
            $this->expect($socket, 250);

            fwrite($socket, "QUIT\r\n");
        } finally {
            fclose($socket);
        }
    }

    private function command($socket, string $cmd, int $expectedCode): void {
        fwrite($socket, $cmd . "\r\n");
        $this->expect($socket, $expectedCode);
    }

    private function expect($socket, int $expectedCode): void {
        $response = $this->readResponse($socket);
        $code = (int) substr($response, 0, 3);
        if ($code !== $expectedCode) {
            throw new RuntimeException("SMTP error — expected $expectedCode, got: $response");
        }
    }

    private function readResponse($socket): string {
        $data = '';
        while ($line = fgets($socket, 515)) {
            $data .= $line;
            if (strlen($line) < 4 || $line[3] === ' ') break; // last line of a multi-line reply
        }
        return $data;
    }
}
