<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Server;
use App\Services\AuditLogService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Inertia\Inertia;

class ServerController extends Controller
{
    public function index()
    {
        $servers = Server::all();
        
        return Inertia::render('Admin/Servers/Index', [
            'servers' => $servers,
        ]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'display_name' => 'required|string|max:255',
            'hostname' => 'required|string|max:255',
            'port' => 'required|integer|min:1|max:65535',
            'https' => 'required|boolean',
            'access_secret' => 'required|string|max:500',
        ]);

        $server = Server::create([
            'display_name' => $request->display_name,
            'hostname' => $request->hostname,
            'port' => $request->port,
            'https' => $request->https,
            'access_secret' => $request->access_secret,
        ]);

        AuditLogService::logServerAction('server_created', $server, [
            'display_name' => $server->display_name,
            'hostname' => $server->hostname,
            'port' => $server->port,
            'https' => $server->https,
        ]);

        return back()->with('success', 'Server created successfully.');
    }

    public function update(Request $request, Server $server)
    {
        $request->validate([
            'display_name' => 'required|string|max:255',
            'hostname' => 'required|string|max:255',
            'port' => 'required|integer|min:1|max:65535',
            'https' => 'required|boolean',
            'access_secret' => 'nullable|string|max:500',
        ]);

        $updateData = [
            'display_name' => $request->display_name,
            'hostname' => $request->hostname,
            'port' => $request->port,
            'https' => $request->https,
        ];

        // Only update secret if provided
        if ($request->filled('access_secret')) {
            $updateData['access_secret'] = $request->access_secret;
        }

        $oldValues = $server->toArray();
        $server->update($updateData);
        
        AuditLogService::logServerAction('server_updated', $server, [
            'old_values' => $oldValues,
            'new_values' => $updateData,
        ]);

        return back()->with('success', 'Server updated successfully.');
    }

    public function destroy(Server $server)
    {
        AuditLogService::logServerAction('server_deleted', $server, [
            'display_name' => $server->display_name,
            'hostname' => $server->hostname,
            'port' => $server->port,
        ]);

        $server->delete();

        return back()->with('success', 'Server deleted successfully.');
    }

    public function show(Server $server)
    {
        return response()->json([
            'id' => $server->id,
            'display_name' => $server->display_name,
            'hostname' => $server->hostname,
            'port' => $server->port,
            'https' => $server->https,
            'access_secret' => $server->access_secret,
            'created_at' => $server->created_at,
            'updated_at' => $server->updated_at,
        ]);
    }

    public function healthCheck(Server $server)
    {
        try {
            $protocol = $server->https ? 'https' : 'http';
            $url = "{$protocol}://{$server->hostname}:{$server->port}/health";
            
            $response = Http::timeout(config('app.agent_http_timeout', 120))->withHeaders([
                'Authorization' => 'Bearer ' . $server->access_secret,
                'Accept' => 'application/json',
                'Accept-Encoding' => 'gzip',
            ])->get($url);
            
            if ($response->successful()) {
                $healthData = $response->json();
                
                AuditLogService::logServerAction('server_health_check', $server, [
                    'status' => 'success',
                    'health_status' => $healthData['status'] ?? 'unknown',
                ]);
                
                return response()->json([
                    'status' => 'success',
                    'health_status' => $healthData['status'] ?? 'unknown',
                    'service' => $healthData['service'] ?? null,
                    'docker_compose' => $healthData['docker_compose'] ?? null,
                    'response_time' => $response->transferStats?->getTransferTime() ?? null,
                    'checked_at' => now()->toISOString(),
                ]);
            } else {
                AuditLogService::logServerAction('server_health_check', $server, [
                    'status' => 'error',
                    'http_status' => $response->status(),
                ]);
                
                return response()->json([
                    'status' => 'error',
                    'message' => 'Server returned status: ' . $response->status(),
                    'health_status' => 'unhealthy',
                    'checked_at' => now()->toISOString(),
                ], 200);
            }
        } catch (\Exception $e) {
            AuditLogService::logServerAction('server_health_check', $server, [
                'status' => 'error',
                'error_message' => $e->getMessage(),
            ]);
            
            return response()->json([
                'status' => 'error',
                'message' => 'Failed to connect: ' . $e->getMessage(),
                'health_status' => 'unreachable',
                'checked_at' => now()->toISOString(),
            ], 200);
        }
    }
}