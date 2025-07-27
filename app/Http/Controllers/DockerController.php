<?php

namespace App\Http\Controllers;

use App\Models\Server;
use App\Services\AuditLogService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Inertia\Inertia;

class DockerController extends Controller
{
    /**
     * Get Docker system information for a server
     */
    public function getSystemInfo(Request $request, Server $server)
    {
        // Check if user has access permission for this server
        if (!auth()->user()->hasServerPermission($server, 'access')) {
            AuditLogService::logAccessDenied('docker_system_info', [
                'server_id' => $server->id,
                'server_name' => $server->display_name,
            ]);
            abort(403, 'You do not have permission to view Docker information on this server.');
        }

        try {
            $protocol = $server->https ? 'https' : 'http';
            $url = "{$protocol}://{$server->hostname}:{$server->port}/api/v1/docker/system/info";
            
            $response = Http::timeout(config('app.agent_http_timeout', 120))
                ->withHeaders([
                    'Authorization' => 'Bearer ' . $server->access_secret,
                    'Accept' => 'application/json',
                ])
                ->get($url);

            if (!$response->successful()) {
                throw new \Exception("Server returned status: {$response->status()}");
            }

            $systemInfo = $response->json();
            
            AuditLogService::logServerAction('docker_system_info_viewed', $server, [
                'action' => 'get_system_info',
            ]);

            return response()->json($systemInfo);
        } catch (\Exception $e) {
            AuditLogService::logServerAction('docker_system_info_failed', $server, [
                'action' => 'get_system_info',
                'error' => $e->getMessage(),
            ]);
            
            return response()->json([
                'error' => 'Failed to fetch Docker system information: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get Docker disk usage for a server
     */
    public function getDiskUsage(Request $request, Server $server)
    {
        // Check if user has access permission for this server
        if (!auth()->user()->hasServerPermission($server, 'access')) {
            AuditLogService::logAccessDenied('docker_disk_usage', [
                'server_id' => $server->id,
                'server_name' => $server->display_name,
            ]);
            abort(403, 'You do not have permission to view Docker disk usage on this server.');
        }

        try {
            $protocol = $server->https ? 'https' : 'http';
            $url = "{$protocol}://{$server->hostname}:{$server->port}/api/v1/docker/system/df";
            
            $response = Http::timeout(config('app.agent_http_timeout', 120))
                ->withHeaders([
                    'Authorization' => 'Bearer ' . $server->access_secret,
                    'Accept' => 'application/json',
                ])
                ->get($url);

            if (!$response->successful()) {
                throw new \Exception("Server returned status: {$response->status()}");
            }

            $diskUsage = $response->json();
            
            AuditLogService::logServerAction('docker_disk_usage_viewed', $server, [
                'action' => 'get_disk_usage',
            ]);

            return response()->json($diskUsage);
        } catch (\Exception $e) {
            AuditLogService::logServerAction('docker_disk_usage_failed', $server, [
                'action' => 'get_disk_usage',
                'error' => $e->getMessage(),
            ]);
            
            return response()->json([
                'error' => 'Failed to fetch Docker disk usage: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Display the Docker maintenance dashboard
     */
    public function index(Request $request, Server $server)
    {
        // Check if user has access permission for this server
        if (!auth()->user()->hasServerPermission($server, 'access')) {
            AuditLogService::logAccessDenied('docker_maintenance_view', [
                'server_id' => $server->id,
                'server_name' => $server->display_name,
            ]);
            abort(403, 'You do not have permission to view Docker maintenance on this server.');
        }

        AuditLogService::logServerAction('docker_maintenance_viewed', $server, [
            'action' => 'view_maintenance_dashboard',
        ]);

        return Inertia::render('Docker/Index', [
            'server' => $server,
            'userPermissions' => auth()->user()->getServerPermissions($server),
            'isAdmin' => auth()->user()->isAdmin(),
        ]);
    }
}