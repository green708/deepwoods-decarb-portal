<?php
declare(strict_types=1);

// Minimal SMTP client using plain sockets — no external library. Sends mail
// via Gmail's SMTP relay (smtp.gmail.com:587, STARTTLS, AUTH LOGIN) using an
// account + App Password. Same "no Composer needed" approach as GoogleDrive.php.

class Smtp {
    public function __construct(
        private string $host,
        private int $port,
        private string $username,
        private string $password,
        private string $fromEmail,
        private string $fromName = 'Deepwoods GHG Portal'
    ) {}

    public function send(string $to, string $subject, string $htmlBody): void {
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
            $this->command($socket, "RCPT TO: <{$to}>", 250);
            $this->command($socket, "DATA", 354);

            // SMTP dot-stuffing: any line starting with "." must be escaped.
            $safeBody = preg_replace('/^\./m', '..', $htmlBody);

            $headers = "From: {$this->fromName} <{$this->fromEmail}>\r\n";
            $headers .= "Reply-To: <{$this->fromEmail}>\r\n";
            $headers .= "To: <{$to}>\r\n";
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
