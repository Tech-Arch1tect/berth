<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Server;
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

        Server::create([
            'display_name' => $request->display_name,
            'hostname' => $request->hostname,
            'port' => $request->port,
            'https' => $request->https,
            'access_secret' => $request->access_secret,
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

        $server->update($updateData);

        return back()->with('success', 'Server updated successfully.');
    }

    public function destroy(Server $server)
    {
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
            
            $response = Http::timeout(10)->withHeaders([
                'Authorization' => 'Bearer ' . $server->access_secret,
                'Accept' => 'application/json',
            ])->get($url);
            
            if ($response->successful()) {
                $healthData = $response->json();
                return response()->json([
                    'status' => 'success',
                    'health_status' => $healthData['status'] ?? 'unknown',
                    'service' => $healthData['service'] ?? null,
                    'docker_compose' => $healthData['docker_compose'] ?? null,
                    'response_time' => $response->transferStats?->getTransferTime() ?? null,
                    'checked_at' => now()->toISOString(),
                ]);
            } else {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Server returned status: ' . $response->status(),
                    'health_status' => 'unhealthy',
                    'checked_at' => now()->toISOString(),
                ], 200);
            }
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Failed to connect: ' . $e->getMessage(),
                'health_status' => 'unreachable',
                'checked_at' => now()->toISOString(),
            ], 200);
        }
    }
}