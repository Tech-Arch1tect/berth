<?php

namespace App\Http\Controllers;

use App\Models\Server;
use App\Models\Stack;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Inertia\Inertia;

class StackController extends Controller
{
    public function index(Request $request, Server $server)
    {
        // Check if user has read permission for this server
        if (!auth()->user()->hasServerPermission($server, 'read')) {
            abort(403, 'You do not have permission to view stacks on this server.');
        }

        try {
            $stacks = $this->fetchStacksFromServer($server);
            
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
        // Check if user has read permission for this server
        if (!auth()->user()->hasServerPermission($server, 'read')) {
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
        // Check if user has read permission for this server
        if (!auth()->user()->hasServerPermission($server, 'read')) {
            return response()->json(['error' => 'Insufficient permissions'], 403);
        }

        try {
            $stacks = $this->fetchStacksFromServer($server);
            return response()->json(['stacks' => $stacks]);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Failed to fetch stacks: ' . $e->getMessage()], 500);
        }
    }

    protected function fetchStacksFromServer(Server $server): array
    {
        $protocol = $server->https ? 'https' : 'http';
        $url = "{$protocol}://{$server->hostname}:{$server->port}/api/v1/stacks/stacks";
        
        $response = Http::timeout(30)
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

    protected function fetchServiceStatusFromServer(Server $server, string $stackName): array
    {
        $protocol = $server->https ? 'https' : 'http';
        $url = "{$protocol}://{$server->hostname}:{$server->port}/api/v1/stacks/{$stackName}/compose/ps";
        
        $response = Http::timeout(30)
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

    public function refresh(Request $request, Server $server)
    {
        // Check if user has read permission for this server
        if (!auth()->user()->hasServerPermission($server, 'read')) {
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
        // Check if user has read permission for this server
        if (!auth()->user()->hasServerPermission($server, 'read')) {
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
}