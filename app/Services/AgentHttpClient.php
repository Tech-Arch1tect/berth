<?php

namespace App\Services;

use App\Models\Server;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

class AgentHttpClient
{
    /**
     * Make a GET request to the berth-agent
     */
    public function get(Server $server, string $endpoint, array $queryParams = []): Response
    {
        $url = $this->buildUrl($server, $endpoint);
        
        return Http::timeout(config('app.agent_http_timeout', 120))
            ->withHeaders($this->getDefaultHeaders($server))
            ->get($url, $queryParams);
    }

    /**
     * Make a POST request to the berth-agent
     */
    public function post(Server $server, string $endpoint, array $data = [], array $queryParams = []): Response
    {
        $url = $this->buildUrl($server, $endpoint);
        
        if (!empty($queryParams)) {
            $url .= '?' . http_build_query($queryParams);
        }

        return Http::timeout(config('app.agent_http_timeout', 120))
            ->withHeaders($this->getDefaultHeaders($server, true))
            ->post($url, $data);
    }

    /**
     * Make a PUT request to the berth-agent
     */
    public function put(Server $server, string $endpoint, array $data = [], array $queryParams = []): Response
    {
        $url = $this->buildUrl($server, $endpoint);
        
        if (!empty($queryParams)) {
            $url .= '?' . http_build_query($queryParams);
        }

        return Http::timeout(config('app.agent_http_timeout', 120))
            ->withHeaders($this->getDefaultHeaders($server, true))
            ->put($url, $data);
    }

    /**
     * Make a PATCH request to the berth-agent
     */
    public function patch(Server $server, string $endpoint, array $data = [], array $queryParams = []): Response
    {
        $url = $this->buildUrl($server, $endpoint);
        
        if (!empty($queryParams)) {
            $url .= '?' . http_build_query($queryParams);
        }

        return Http::timeout(config('app.agent_http_timeout', 120))
            ->withHeaders($this->getDefaultHeaders($server, true))
            ->patch($url, $data);
    }

    /**
     * Make a DELETE request to the berth-agent
     */
    public function delete(Server $server, string $endpoint, array $queryParams = []): Response
    {
        $url = $this->buildUrl($server, $endpoint);
        
        if (!empty($queryParams)) {
            $url .= '?' . http_build_query($queryParams);
        }

        return Http::timeout(config('app.agent_http_timeout', 120))
            ->withHeaders($this->getDefaultHeaders($server))
            ->delete($url);
    }

    /**
     * Create a streaming cURL request for server-sent events
     */
    public function stream(Server $server, string $endpoint, array $queryParams = [], callable $callback = null)
    {
        $url = $this->buildUrl($server, $endpoint);
        
        if (!empty($queryParams)) {
            $url .= '?' . http_build_query($queryParams);
        }

        $timeout = config('app.agent_http_timeout', 600);

        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_HTTPGET => true,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $server->access_secret,
                'Accept: text/event-stream',
                'Accept-Encoding: gzip',
            ],
            CURLOPT_WRITEFUNCTION => $callback ?: function($ch, $data) {
                echo $data;
                flush();
                return strlen($data);
            },
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_SSL_VERIFYPEER => false,
        ]);

        $result = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        
        if ($result === false || $httpCode !== 200) {
            $error = curl_error($ch);
            echo "data: {\"type\":\"error\",\"timestamp\":\"" . date('c') . "\",\"message\":\"" . ($error ?: "HTTP {$httpCode}") . "\"}\n\n";
            flush();
        }
        
        curl_close($ch);
    }

    /**
     * Build the full URL for an agent endpoint
     */
    protected function buildUrl(Server $server, string $endpoint): string
    {
        $protocol = $server->https ? 'https' : 'http';
        $endpoint = ltrim($endpoint, '/');
        
        return "{$protocol}://{$server->hostname}:{$server->port}/{$endpoint}";
    }

    /**
     * Get default headers for agent requests
     */
    protected function getDefaultHeaders(Server $server, bool $includeContentType = false): array
    {
        $headers = [
            'Authorization' => 'Bearer ' . $server->access_secret,
            'Accept' => 'application/json',
            'Accept-Encoding' => 'gzip',
        ];

        if ($includeContentType) {
            $headers['Content-Type'] = 'application/json';
        }

        return $headers;
    }

    /**
     * Check if a response is successful and throw exception if not
     */
    public function ensureSuccessful(Response $response): Response
    {
        if (!$response->successful()) {
            $errorData = $response->json();
            if (isset($errorData['error'])) {
                throw new \Exception($errorData['error']);
            }
            throw new \Exception("Server returned status: {$response->status()}");
        }

        return $response;
    }

    /**
     * Get response JSON data with validation
     */
    public function getJsonData(Response $response): array
    {
        $this->ensureSuccessful($response);
        
        $data = $response->json();
        
        if (!is_array($data)) {
            throw new \Exception("Invalid response format from server");
        }

        return $data;
    }
}