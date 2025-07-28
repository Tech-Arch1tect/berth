<?php

namespace App\Http\Controllers;

use App\Models\Server;
use App\Models\Stack;
use App\Services\AuditLogService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Inertia\Inertia;

class StackController extends Controller
{
    public function index(Request $request, Server $server)
    {
        // Check if user has access permission for this server
        if (!auth()->user()->hasServerPermission($server, 'access')) {
            AuditLogService::logAccessDenied('stack_view', [
                'server_id' => $server->id,
                'server_name' => $server->display_name,
            ]);
            abort(403, 'You do not have permission to view stacks on this server.');
        }

        try {
            $stacks = $this->fetchStacksFromServer($server);
            
            AuditLogService::logStackAction('stack_viewed', $server, 'index', [
                'action' => 'list_stacks',
                'stack_count' => count($stacks),
            ]);
            
            return Inertia::render('Stacks/Index', [
                'server' => $server,
                'stacks' => $stacks,
                'userPermissions' => auth()->user()->getServerPermissions($server),
                'isAdmin' => auth()->user()->isAdmin(),
            ]);
        } catch (\Exception $e) {
            return Inertia::render('Stacks/Index', [
                'server' => $server,
                'stacks' => [],
                'error' => 'Failed to fetch stacks: ' . $e->getMessage(),
                'userPermissions' => auth()->user()->getServerPermissions($server),
                'isAdmin' => auth()->user()->isAdmin(),
            ]);
        }
    }

    public function show(Request $request, Server $server, string $stackName)
    {
        // Check if user has access permission for this server
        if (!auth()->user()->hasServerPermission($server, 'access')) {
            AuditLogService::logAccessDenied('stack_view', [
                'server_id' => $server->id,
                'server_name' => $server->display_name,
                'stack_name' => $stackName,
            ]);
            abort(403, 'You do not have permission to view stacks on this server.');
        }

        try {
            $stacks = $this->fetchStacksFromServer($server);
            $stack = collect($stacks)->firstWhere('name', $stackName);
            
            if (!$stack) {
                abort(404, 'Stack not found.');
            }

            // Fetch service status for this specific stack
            try {
                $serviceStatus = $this->fetchServiceStatusFromServer($server, $stackName);
                $stack['service_status'] = $serviceStatus;
                
                // Create a Stack model instance to calculate status fields
                $stackModel = Stack::fromArray($stack);
                $stack = $stackModel->toArray();
            } catch (\Exception $e) {
                // If we can't fetch service status, continue without it
                $stack['service_status'] = null;
            }

            AuditLogService::logStackAction('stack_viewed', $server, $stackName, [
                'action' => 'view_stack_details',
                'service_count' => count($stack['service_status']['services'] ?? []),
            ]);

            return Inertia::render('Stacks/Show', [
                'server' => $server,
                'stack' => $stack,
                'userPermissions' => auth()->user()->getServerPermissions($server),
            ]);
        } catch (\Exception $e) {
            return back()->withErrors(['error' => 'Failed to fetch stack details: ' . $e->getMessage()]);
        }
    }

    public function apiIndex(Request $request, Server $server)
    {
        // Check if user has access permission for this server
        if (!auth()->user()->hasServerPermission($server, 'access')) {
            return response()->json(['error' => 'Insufficient permissions'], 403);
        }

        try {
            $stacks = $this->fetchStacksFromServer($server);
            return response()->json(['stacks' => $stacks]);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Failed to fetch stacks: ' . $e->getMessage()], 500);
        }
    }

    public function fetchStacksFromServer(Server $server): array
    {
        $protocol = $server->https ? 'https' : 'http';
        $url = "{$protocol}://{$server->hostname}:{$server->port}/api/v1/stacks/stacks";
        
        $response = Http::timeout(config('app.agent_http_timeout', 120))
            ->withHeaders([
                'Authorization' => 'Bearer ' . $server->access_secret,
                'Accept' => 'application/json',
            ])
            ->get($url);

        if (!$response->successful()) {
            throw new \Exception("Server returned status: {$response->status()}");
        }

        $stacksData = $response->json();
        
        if (!is_array($stacksData)) {
            throw new \Exception("Invalid response format from server");
        }

        // Convert raw stack data to Stack models
        return array_map(function ($stackData) {
            $stack = Stack::fromArray($stackData);
            return $stack->toArray();
        }, $stacksData);
    }

    public function fetchStacksWithStatusFromServer(Server $server): array
    {
        $protocol = $server->https ? 'https' : 'http';
        $url = "{$protocol}://{$server->hostname}:{$server->port}/api/v1/bulk/stacks-with-status";
        
        $response = Http::timeout(config('app.agent_http_timeout', 120))
            ->withHeaders([
                'Authorization' => 'Bearer ' . $server->access_secret,
                'Accept' => 'application/json',
            ])
            ->get($url);

        if (!$response->successful()) {
            throw new \Exception("Server returned status: {$response->status()}");
        }

        $bulkData = $response->json();
        
        if (!isset($bulkData['stacks']) || !is_array($bulkData['stacks'])) {
            throw new \Exception("Invalid bulk response format from server");
        }

        return array_map(function ($stackData) {
            $serviceStatus = $stackData['service_status'] ?? null;
            
            unset($stackData['service_status']);
            
            $stack = Stack::fromArray($stackData);
            $stackArray = $stack->toArray();
            
            if ($serviceStatus) {
                $stackArray['service_status'] = $serviceStatus;
            }
            
            return $stackArray;
        }, $bulkData['stacks']);
    }

    public function fetchServiceStatusFromServer(Server $server, string $stackName): array
    {
        $protocol = $server->https ? 'https' : 'http';
        $url = "{$protocol}://{$server->hostname}:{$server->port}/api/v1/stacks/{$stackName}/compose/ps";
        
        $response = Http::timeout(config('app.agent_http_timeout', 120))
            ->withHeaders([
                'Authorization' => 'Bearer ' . $server->access_secret,
                'Accept' => 'application/json',
            ])
            ->get($url);

        if (!$response->successful()) {
            throw new \Exception("Server returned status: {$response->status()}");
        }

        $statusData = $response->json();
        
        if (!is_array($statusData)) {
            throw new \Exception("Invalid response format from server");
        }

        return $statusData;
    }

    protected function fetchLogsFromServer(Server $server, string $stackName, ?string $service = null, string $tail = '100'): array
    {
        $protocol = $server->https ? 'https' : 'http';
        $url = "{$protocol}://{$server->hostname}:{$server->port}/api/v1/stacks/{$stackName}/compose/logs";
        
        $queryParams = ['tail' => $tail];
        if ($service) {
            $queryParams['service'] = $service;
        }
        
        $response = Http::timeout(config('app.agent_http_timeout', 120))
            ->withHeaders([
                'Authorization' => 'Bearer ' . $server->access_secret,
                'Accept' => 'application/json',
            ])
            ->get($url, $queryParams);

        if (!$response->successful()) {
            throw new \Exception("Server returned status: {$response->status()}");
        }

        $logsData = $response->json();
        
        if (!is_array($logsData)) {
            throw new \Exception("Invalid response format from server");
        }

        return $logsData;
    }

    public function refresh(Request $request, Server $server)
    {
        // Check if user has access permission for this server
        if (!auth()->user()->hasServerPermission($server, 'access')) {
            return response()->json(['error' => 'Insufficient permissions'], 403);
        }

        try {
            $stacks = $this->fetchStacksFromServer($server);
            return response()->json([
                'stacks' => $stacks,
                'message' => 'Stacks refreshed successfully',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Failed to refresh stacks: ' . $e->getMessage()
            ], 500);
        }
    }

    public function getServiceStatus(Request $request, Server $server, string $stackName)
    {
        // Check if user has access permission for this server
        if (!auth()->user()->hasServerPermission($server, 'access')) {
            return response()->json(['error' => 'Insufficient permissions'], 403);
        }

        try {
            $serviceStatus = $this->fetchServiceStatusFromServer($server, $stackName);
            return response()->json($serviceStatus);
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Failed to fetch service status: ' . $e->getMessage()
            ], 500);
        }
    }

    public function getLogs(Request $request, Server $server, string $stackName)
    {
        // Check if user has access permission for this server
        if (!auth()->user()->hasServerPermission($server, 'access')) {
            return response()->json(['error' => 'Insufficient permissions'], 403);
        }

        try {
            $service = $request->query('service');
            $tail = $request->query('tail', '100');
            
            $logs = $this->fetchLogsFromServer($server, $stackName, $service, $tail);
            return response()->json($logs);
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Failed to fetch logs: ' . $e->getMessage()
            ], 500);
        }
    }



    public function composeUpStream(Request $request, Server $server, string $stackName)
    {
        if (!auth()->user()->hasServerPermission($server, 'start-stop')) {
            AuditLogService::logAccessDenied('stack_start', [
                'server_id' => $server->id,
                'server_name' => $server->display_name,
                'stack_name' => $stackName,
            ]);
            return response()->json(['error' => 'Insufficient permissions'], 403);
        }

        $services = $request->query('services', '');
        $servicesArray = $services ? explode(',', $services) : [];
        
        if (!empty($servicesArray)) {
            foreach ($servicesArray as $service) {
                AuditLogService::logStackAction('service_up', $server, $stackName, [
                    'service' => trim($service),
                    'build' => $request->query('build', false) === 'true',
                ]);
            }
        } else {
            AuditLogService::logStackAction('stack_up', $server, $stackName, [
                'services' => $services,
                'build' => $request->query('build', false) === 'true',
            ]);
        }

        return $this->streamComposeOperation($request, $server, $stackName, 'up');
    }

    public function composeDownStream(Request $request, Server $server, string $stackName)
    {
        if (!auth()->user()->hasServerPermission($server, 'start-stop')) {
            AuditLogService::logAccessDenied('stack_stop', [
                'server_id' => $server->id,
                'server_name' => $server->display_name,
                'stack_name' => $stackName,
            ]);
            return response()->json(['error' => 'Insufficient permissions'], 403);
        }

        $services = $request->query('services', '');
        $servicesArray = $services ? explode(',', $services) : [];
        
        if (!empty($servicesArray)) {
            foreach ($servicesArray as $service) {
                AuditLogService::logStackAction('service_down', $server, $stackName, [
                    'service' => trim($service),
                    'remove_volumes' => $request->query('remove_volumes', false) === 'true',
                    'remove_images' => $request->query('remove_images', false) === 'true',
                ]);
            }
        } else {
            AuditLogService::logStackAction('stack_down', $server, $stackName, [
                'services' => $services,
                'remove_volumes' => $request->query('remove_volumes', false) === 'true',
                'remove_images' => $request->query('remove_images', false) === 'true',
            ]);
        }

        return $this->streamComposeOperation($request, $server, $stackName, 'down');
    }

    public function composePullStream(Request $request, Server $server, string $stackName)
    {
        if (!auth()->user()->hasServerPermission($server, 'start-stop')) {
            AuditLogService::logAccessDenied('stack_pull', [
                'server_id' => $server->id,
                'server_name' => $server->display_name,
                'stack_name' => $stackName,
            ]);
            return response()->json(['error' => 'Insufficient permissions'], 403);
        }

        $services = $request->query('services', '');
        $servicesArray = $services ? explode(',', $services) : [];
        
        if (!empty($servicesArray)) {
            foreach ($servicesArray as $service) {
                AuditLogService::logStackAction('service_pull', $server, $stackName, [
                    'service' => trim($service),
                ]);
            }
        } else {
            AuditLogService::logStackAction('stack_pull', $server, $stackName, [
                'services' => $services,
            ]);
        }

        return $this->streamComposeOperation($request, $server, $stackName, 'pull');
    }

    protected function streamComposeOperation(Request $request, Server $server, string $stackName, string $operation)
    {
        try {
            $protocol = $server->https ? 'https' : 'http';
            $url = "{$protocol}://{$server->hostname}:{$server->port}/api/v1/stacks/{$stackName}/compose/{$operation}/stream";
            
            $params = [];
            if ($operation === 'up') {
                $services = $request->query('services', '');
                $params['services'] = $services ? explode(',', $services) : [];
                $params['build'] = $request->query('build', false) === 'true';
            } elseif ($operation === 'down') {
                $services = $request->query('services', '');
                $params['services'] = $services ? explode(',', $services) : [];
                $params['remove_volumes'] = $request->query('remove_volumes', false) === 'true';
                $params['remove_images'] = $request->query('remove_images', false) === 'true';
            } elseif ($operation === 'pull') {
                $services = $request->query('services', '');
                $params['services'] = $services ? explode(',', $services) : [];
            }

            return response()->stream(function () use ($url, $server, $params) {
                try {
                    $timeout = config('app.agent_http_timeout', 600);
                    
                    $queryParams = [];
                    if (isset($params['services']) && !empty($params['services'])) {
                        $queryParams['services'] = implode(',', $params['services']);
                    }
                    if (isset($params['build']) && $params['build']) {
                        $queryParams['build'] = 'true';
                    }
                    if (isset($params['remove_volumes']) && $params['remove_volumes']) {
                        $queryParams['remove_volumes'] = 'true';
                    }
                    if (isset($params['remove_images']) && $params['remove_images']) {
                        $queryParams['remove_images'] = 'true';
                    }
                    $queryParams['timeout'] = $timeout;
                    
                    $finalUrl = $url;
                    if (!empty($queryParams)) {
                        $finalUrl .= '?' . http_build_query($queryParams);
                    }

                    $ch = curl_init();
                    curl_setopt_array($ch, [
                        CURLOPT_URL => $finalUrl,
                        CURLOPT_HTTPGET => true,
                        CURLOPT_HTTPHEADER => [
                            'Authorization: Bearer ' . $server->access_secret,
                            'Accept: text/event-stream',
                        ],
                        CURLOPT_WRITEFUNCTION => function($ch, $data) {
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
                } catch (\Exception $e) {
                    echo "data: {\"type\":\"error\",\"timestamp\":\"" . date('c') . "\",\"message\":\"" . addslashes($e->getMessage()) . "\"}\n\n";
                    flush();
                }
            }, 200, [
                'Content-Type' => 'text/event-stream; charset=utf-8',
                'Cache-Control' => 'no-cache',
                'Connection' => 'keep-alive',
                'X-Accel-Buffering' => 'no',
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Failed to start streaming operation: ' . $e->getMessage()
            ], 500);
        }
    }

    public function listFiles(Request $request, Server $server, string $stackName)
    {
        // Check if user has filemanager_access permission for this server
        if (!auth()->user()->hasServerPermission($server, 'filemanager_access')) {
            return response()->json(['error' => 'Insufficient permissions'], 403);
        }

        try {
            $path = $request->query('path', '.');
            $files = $this->fetchFilesFromServer($server, $stackName, $path);
            return response()->json($files);
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Failed to fetch files: ' . $e->getMessage()
            ], 500);
        }
    }

    public function readFile(Request $request, Server $server, string $stackName)
    {
        // Check if user has filemanager_access permission for this server
        if (!auth()->user()->hasServerPermission($server, 'filemanager_access')) {
            return response()->json(['error' => 'Insufficient permissions'], 403);
        }

        try {
            $path = $request->query('path');
            if (!$path) {
                return response()->json(['error' => 'Path parameter is required'], 400);
            }
            
            $fileData = $this->fetchFileFromServer($server, $stackName, $path);
            
            AuditLogService::logFileAction('file_viewed', $server, $stackName, $path, [
                'file_size' => isset($fileData['content']) ? strlen($fileData['content']) : 0,
                'file_type' => pathinfo($path, PATHINFO_EXTENSION) ?: 'unknown',
            ]);
            
            return response()->json($fileData);
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Failed to fetch file: ' . $e->getMessage()
            ], 500);
        }
    }

    public function createFile(Request $request, Server $server, string $stackName)
    {
        // Check if user has filemanager_write permission for this server
        if (!auth()->user()->hasServerPermission($server, 'filemanager_write')) {
            return response()->json(['error' => 'Insufficient permissions'], 403);
        }

        try {
            $path = $request->input('path');
            $content = $request->input('content', '');
            
            if (!$path) {
                return response()->json(['error' => 'Path parameter is required'], 400);
            }
            
            $result = $this->sendFileCreateRequest($server, $stackName, $path, $content);
            
            AuditLogService::logFileAction('file_created', $server, $stackName, $path, [
                'file_size' => strlen($content),
            ]);
            
            return response()->json($result);
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Failed to create file: ' . $e->getMessage()
            ], 500);
        }
    }

    public function updateFile(Request $request, Server $server, string $stackName)
    {
        // Check if user has filemanager_write permission for this server
        if (!auth()->user()->hasServerPermission($server, 'filemanager_write')) {
            return response()->json(['error' => 'Insufficient permissions'], 403);
        }

        try {
            $path = $request->input('path');
            $content = $request->input('content', '');
            
            if (!$path) {
                return response()->json(['error' => 'Path parameter is required'], 400);
            }
            
            $result = $this->sendFileUpdateRequest($server, $stackName, $path, $content);
            
            AuditLogService::logFileAction('file_updated', $server, $stackName, $path, [
                'file_size' => strlen($content),
            ]);
            
            return response()->json($result);
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Failed to update file: ' . $e->getMessage()
            ], 500);
        }
    }

    public function getConfig(Request $request)
    {
        return response()->json([
            'agent_timeout' => config('app.agent_http_timeout', 600) * 1000
        ]);
    }

    public function deleteFile(Request $request, Server $server, string $stackName)
    {
        // Check if user has filemanager_write permission for this server
        if (!auth()->user()->hasServerPermission($server, 'filemanager_write')) {
            return response()->json(['error' => 'Insufficient permissions'], 403);
        }

        try {
            $path = $request->query('path');
            $recursive = $request->query('recursive', 'false') === 'true';
            
            if (!$path) {
                return response()->json(['error' => 'Path parameter is required'], 400);
            }
            
            $result = $this->sendFileDeleteRequest($server, $stackName, $path, $recursive);
            
            AuditLogService::logFileAction('file_deleted', $server, $stackName, $path, [
                'recursive' => $recursive,
            ]);
            
            return response()->json($result);
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Failed to delete file: ' . $e->getMessage()
            ], 500);
        }
    }

    protected function fetchFilesFromServer(Server $server, string $stackName, string $path = '.'): array
    {
        $protocol = $server->https ? 'https' : 'http';
        $url = "{$protocol}://{$server->hostname}:{$server->port}/api/v1/stacks/{$stackName}/files";
        
        $queryParams = ['path' => $path];
        
        $response = Http::timeout(config('app.agent_http_timeout', 120))
            ->withHeaders([
                'Authorization' => 'Bearer ' . $server->access_secret,
                'Accept' => 'application/json',
            ])
            ->get($url, $queryParams);

        if (!$response->successful()) {
            throw new \Exception("Server returned status: {$response->status()}");
        }

        $filesData = $response->json();
        
        if (!is_array($filesData) && !isset($filesData['files'])) {
            throw new \Exception("Invalid response format from server");
        }

        return $filesData;
    }

    protected function fetchFileFromServer(Server $server, string $stackName, string $path): array
    {
        $protocol = $server->https ? 'https' : 'http';
        $url = "{$protocol}://{$server->hostname}:{$server->port}/api/v1/stacks/{$stackName}/file";
        
        $queryParams = ['path' => $path];
        
        $response = Http::timeout(config('app.agent_http_timeout', 120))
            ->withHeaders([
                'Authorization' => 'Bearer ' . $server->access_secret,
                'Accept' => 'application/json',
            ])
            ->get($url, $queryParams);

        if (!$response->successful()) {
            $errorData = $response->json();
            if (isset($errorData['error'])) {
                throw new \Exception($errorData['error']);
            }
            throw new \Exception("Server returned status: {$response->status()}");
        }

        $fileData = $response->json();
        
        if (!is_array($fileData)) {
            throw new \Exception("Invalid response format from server");
        }

        return $fileData;
    }

    protected function sendComposeCommand(Server $server, string $stackName, string $action, array $params = []): array
    {
        $protocol = $server->https ? 'https' : 'http';
        $url = "{$protocol}://{$server->hostname}:{$server->port}/api/v1/stacks/{$stackName}/compose/{$action}";
        
        $response = Http::timeout(config('app.agent_http_timeout', 120))
            ->withHeaders([
                'Authorization' => 'Bearer ' . $server->access_secret,
                'Accept' => 'application/json',
                'Content-Type' => 'application/json',
            ])
            ->post($url, $params);

        if (!$response->successful()) {
            $errorData = $response->json();
            if (isset($errorData['error'])) {
                throw new \Exception($errorData['error']);
            }
            throw new \Exception("Server returned status: {$response->status()}");
        }

        $responseData = $response->json();
        
        if (!is_array($responseData)) {
            throw new \Exception("Invalid response format from server");
        }

        return $responseData;
    }

    protected function sendFileCreateRequest(Server $server, string $stackName, string $path, string $content): array
    {
        $protocol = $server->https ? 'https' : 'http';
        $url = "{$protocol}://{$server->hostname}:{$server->port}/api/v1/stacks/{$stackName}/file";
        
        $queryParams = ['path' => $path];
        $bodyData = ['content' => $content];
        
        $response = Http::timeout(config('app.agent_http_timeout', 120))
            ->withHeaders([
                'Authorization' => 'Bearer ' . $server->access_secret,
                'Accept' => 'application/json',
                'Content-Type' => 'application/json',
            ])
            ->post($url . '?' . http_build_query($queryParams), $bodyData);

        if (!$response->successful()) {
            $errorData = $response->json();
            if (isset($errorData['error'])) {
                throw new \Exception($errorData['error']);
            }
            throw new \Exception("Server returned status: {$response->status()}");
        }

        $responseData = $response->json();
        
        if (!is_array($responseData)) {
            throw new \Exception("Invalid response format from server");
        }

        return $responseData;
    }

    protected function sendFileUpdateRequest(Server $server, string $stackName, string $path, string $content): array
    {
        $protocol = $server->https ? 'https' : 'http';
        $url = "{$protocol}://{$server->hostname}:{$server->port}/api/v1/stacks/{$stackName}/file";
        
        $queryParams = ['path' => $path];
        $bodyData = ['content' => $content];
        
        $response = Http::timeout(config('app.agent_http_timeout', 120))
            ->withHeaders([
                'Authorization' => 'Bearer ' . $server->access_secret,
                'Accept' => 'application/json',
                'Content-Type' => 'application/json',
            ])
            ->put($url . '?' . http_build_query($queryParams), $bodyData);

        if (!$response->successful()) {
            $errorData = $response->json();
            if (isset($errorData['error'])) {
                throw new \Exception($errorData['error']);
            }
            throw new \Exception("Server returned status: {$response->status()}");
        }

        $responseData = $response->json();
        
        if (!is_array($responseData)) {
            throw new \Exception("Invalid response format from server");
        }

        return $responseData;
    }

    protected function sendFileDeleteRequest(Server $server, string $stackName, string $path, bool $recursive = false): array
    {
        $protocol = $server->https ? 'https' : 'http';
        $url = "{$protocol}://{$server->hostname}:{$server->port}/api/v1/stacks/{$stackName}/file";
        
        $queryParams = ['path' => $path];
        if ($recursive) {
            $queryParams['recursive'] = 'true';
        }
        
        $response = Http::timeout(config('app.agent_http_timeout', 120))
            ->withHeaders([
                'Authorization' => 'Bearer ' . $server->access_secret,
                'Accept' => 'application/json',
            ])
            ->delete($url . '?' . http_build_query($queryParams));

        if (!$response->successful()) {
            $errorData = $response->json();
            if (isset($errorData['error'])) {
                throw new \Exception($errorData['error']);
            }
            throw new \Exception("Server returned status: {$response->status()}");
        }

        $responseData = $response->json();
        
        if (!is_array($responseData)) {
            throw new \Exception("Invalid response format from server");
        }

        return $responseData;
    }

    public function terminalSession(Server $server, string $stackName, string $service)
    {
        // Check if user has exec permission for this server
        if (!auth()->user()->hasServerPermission($server, 'exec')) {
            return response()->json(['error' => 'Insufficient permissions'], 403);
        }

        try {
            $shell = request()->query('shell', 'auto');
            
            $allowedShells = ['auto', 'bash', 'sh', 'zsh', 'fish', 'dash'];
            if (!in_array($shell, $allowedShells)) {
                $shell = 'auto';
            }
            
            AuditLogService::logStackAction('terminal_accessed', $server, $stackName, [
                'service' => $service,
                'shell' => $shell,
            ]);
            
            $protocol = $server->https ? 'wss' : 'ws';
            $wsUrl = "{$protocol}://{$server->hostname}:{$server->port}/api/v1/stacks/{$stackName}/terminal/session/{$service}";
            
            $wsUrl .= "?shell=" . urlencode($shell);
            
            return response()->json([
                'websocket_url' => $wsUrl,
                'access_token' => $server->access_secret,
                'stack_name' => $stackName,
                'service' => $service,
                'server_name' => $server->display_name,
                'shell' => $shell
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Failed to create terminal session: ' . $e->getMessage()
            ], 500);
        }
    }

    public function getFileMetadata(Request $request, Server $server, string $stackName)
    {
        // Check if user has filemanager_access permission
        if (!auth()->user()->hasServerPermission($server, 'filemanager_access')) {
            return response()->json(['error' => 'You do not have permission to access files on this server.'], 403);
        }

        try {
            $path = $request->query('path', '');
            
            $protocol = $server->https ? 'https' : 'http';
            $url = "{$protocol}://{$server->hostname}:{$server->port}/api/v1/stacks/{$stackName}/file/metadata";
            
            $response = Http::timeout(config('app.agent_http_timeout', 120))
                ->withHeaders([
                    'Authorization' => 'Bearer ' . $server->access_secret,
                    'Accept' => 'application/json',
                ])
                ->get($url, ['path' => $path]);

            if (!$response->successful()) {
                $errorData = $response->json();
                if (isset($errorData['error'])) {
                    throw new \Exception($errorData['error']);
                }
                throw new \Exception("Server returned status: {$response->status()}");
            }

            return response()->json($response->json());
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    public function downloadFile(Request $request, Server $server, string $stackName)
    {
        // Check if user has filemanager_access permission
        if (!auth()->user()->hasServerPermission($server, 'filemanager_access')) {
            abort(403, 'You do not have permission to access files on this server.');
        }

        try {
            $path = $request->query('path', '');
            
            $protocol = $server->https ? 'https' : 'http';
            $url = "{$protocol}://{$server->hostname}:{$server->port}/api/v1/stacks/{$stackName}/file/download";
            
            $response = Http::timeout(config('app.agent_http_timeout', 120))
                ->withHeaders([
                    'Authorization' => 'Bearer ' . $server->access_secret,
                ])
                ->get($url, ['path' => $path]);

            if (!$response->successful()) {
                abort(404, 'File not found or server error');
            }

            $filename = basename($path);
            
            AuditLogService::logFileAction('file_downloaded', $server, $stackName, $path, [
                'filename' => $filename,
                'file_size' => strlen($response->body()),
            ]);
            
            return response($response->body())
                ->header('Content-Type', $response->header('Content-Type') ?: 'application/octet-stream')
                ->header('Content-Disposition', 'attachment; filename="' . $filename . '"')
                ->header('Content-Length', $response->header('Content-Length') ?: strlen($response->body()));
                
        } catch (\Exception $e) {
            abort(500, 'Failed to download file: ' . $e->getMessage());
        }
    }

    public function renameFile(Request $request, Server $server, string $stackName)
    {
        // Check if user has filemanager_write permission
        if (!auth()->user()->hasServerPermission($server, 'filemanager_write')) {
            return response()->json(['error' => 'You do not have permission to rename files on this server.'], 403);
        }

        try {
            $path = $request->query('path', '');
            $newName = $request->input('newName');
            
            if (empty($newName)) {
                return response()->json(['error' => 'New name is required'], 400);
            }

            $protocol = $server->https ? 'https' : 'http';
            $url = "{$protocol}://{$server->hostname}:{$server->port}/api/v1/stacks/{$stackName}/file";
            
            $response = Http::timeout(config('app.agent_http_timeout', 120))
                ->withHeaders([
                    'Authorization' => 'Bearer ' . $server->access_secret,
                    'Accept' => 'application/json',
                    'Content-Type' => 'application/json',
                ])
                ->patch($url . '?' . http_build_query(['path' => $path]), [
                    'newName' => $newName
                ]);

            if (!$response->successful()) {
                $errorData = $response->json();
                if (isset($errorData['error'])) {
                    return response()->json(['error' => $errorData['error']], $response->status());
                }
                return response()->json(['error' => "Server returned status: {$response->status()}"], $response->status());
            }

            AuditLogService::logFileAction('file_renamed', $server, $stackName, $path, [
                'old_name' => basename($path),
                'new_name' => $newName,
                'directory' => dirname($path),
            ]);

            return response()->json($response->json());
        } catch (\Exception $e) {
            return response()->json(['error' => 'Failed to rename file: ' . $e->getMessage()], 500);
        }
    }

    public function getServerStatistics(Server $server): array
    {
        try {
            $stacks = $this->fetchStacksWithStatusFromServer($server);
            
            $totalStacks = count($stacks);
            $runningStacks = 0;
            $totalServices = 0;
            $runningServices = 0;
            
            foreach ($stacks as $stackData) {
                $totalServices += $stackData['service_count'] ?? 0;
                
                if (isset($stackData['service_status'])) {
                    $stackModel = \App\Models\Stack::fromArray($stackData);
                    $statusSummary = $stackModel->getServiceStatusSummary();
                    $overallStatus = $stackModel->getOverallStatus();
                    
                    $runningServices += $statusSummary['running'] ?? 0;
                    if ($overallStatus === 'running') {
                        $runningStacks++;
                    }
                }
            }
            
            return [
                'total_stacks' => $totalStacks,
                'running_stacks' => $runningStacks,
                'total_services' => $totalServices,
                'running_services' => $runningServices,
                'status' => 'online'
            ];
        } catch (\Exception $e) {
            return [
                'total_stacks' => 0,
                'running_stacks' => 0,
                'total_services' => 0,
                'running_services' => 0,
                'status' => 'offline',
                'error' => $e->getMessage()
            ];
        }
    }
}