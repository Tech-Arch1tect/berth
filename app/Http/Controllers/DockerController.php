<?php

namespace App\Http\Controllers;

use App\Models\Server;
use App\Services\AgentHttpClient;
use App\Services\AuditLogService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Inertia\Inertia;

class DockerController extends Controller
{
    protected AgentHttpClient $agentClient;

    public function __construct(AgentHttpClient $agentClient)
    {
        $this->agentClient = $agentClient;
    }
    /**
     * Get Docker system information for a server
     */
    public function getSystemInfo(Request $request, Server $server)
    {
        // Check if user has Docker maintenance read permission for this server
        if (!auth()->user()->hasServerPermission($server, 'docker_maintenance_read')) {
            AuditLogService::logAccessDenied('docker_system_info', [
                'server_id' => $server->id,
                'server_name' => $server->display_name,
            ]);
            abort(403, 'You do not have permission to view Docker information on this server.');
        }

        try {
            $response = $this->agentClient->get($server, 'api/v1/docker/system/info');
            $systemInfo = $this->agentClient->getJsonData($response);
            
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
        // Check if user has Docker maintenance read permission for this server
        if (!auth()->user()->hasServerPermission($server, 'docker_maintenance_read')) {
            AuditLogService::logAccessDenied('docker_disk_usage', [
                'server_id' => $server->id,
                'server_name' => $server->display_name,
            ]);
            abort(403, 'You do not have permission to view Docker disk usage on this server.');
        }

        try {
            $response = $this->agentClient->get($server, 'api/v1/docker/system/df');
            $diskUsage = $this->agentClient->getJsonData($response);
            
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
        // Check if user has Docker maintenance read permission for this server
        if (!auth()->user()->hasServerPermission($server, 'docker_maintenance_read')) {
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

    /**
     * List Docker images for a server
     */
    public function listImages(Request $request, Server $server)
    {
        // Check if user has Docker maintenance read permission for this server
        if (!auth()->user()->hasServerPermission($server, 'docker_maintenance_read')) {
            AuditLogService::logAccessDenied('docker_images_list', [
                'server_id' => $server->id,
                'server_name' => $server->display_name,
            ]);
            abort(403, 'You do not have permission to view Docker images on this server.');
        }

        try {
            $queryParams = [];
            if ($request->has('all')) {
                $queryParams['all'] = $request->boolean('all') ? 'true' : 'false';
            }
            
            $response = $this->agentClient->get($server, 'api/v1/docker/images', $queryParams);
            $images = $this->agentClient->getJsonData($response);
            
            AuditLogService::logServerAction('docker_images_viewed', $server, [
                'action' => 'list_images',
                'image_count' => count($images),
                'include_all' => $request->boolean('all'),
            ]);

            return response()->json($images);
        } catch (\Exception $e) {
            AuditLogService::logServerAction('docker_images_list_failed', $server, [
                'action' => 'list_images',
                'error' => $e->getMessage(),
            ]);
            
            return response()->json([
                'error' => 'Failed to fetch Docker images: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Delete a Docker image
     */
    public function deleteImage(Request $request, Server $server, string $imageId)
    {
        if (!auth()->user()->hasServerPermission($server, 'docker_maintenance_write')) {
            AuditLogService::logAccessDenied('docker_image_delete', [
                'server_id' => $server->id,
                'server_name' => $server->display_name,
                'image_id' => $imageId,
            ]);
            abort(403, 'You do not have permission to delete Docker images on this server.');
        }

        try {
            $response = $this->agentClient->delete($server, 'api/v1/docker/images/' . urlencode($imageId));
            
            $queryParams = [];
            if ($request->has('force')) {
                $queryParams['force'] = $request->boolean('force') ? 'true' : 'false';
            }
            if ($request->has('noprune')) {
                $queryParams['noprune'] = $request->boolean('noprune') ? 'true' : 'false';
            }
            
            if (!empty($queryParams)) {
                $url .= '?' . http_build_query($queryParams);
            }
            $result = $this->agentClient->getJsonData($response);
            
            AuditLogService::logServerAction('docker_image_deleted', $server, [
                'action' => 'delete_image',
                'image_id' => $imageId,
                'force' => $request->boolean('force'),
                'noprune' => $request->boolean('noprune'),
                'deleted_items' => count($result),
            ]);

            return response()->json($result);
        } catch (\Exception $e) {
            AuditLogService::logServerAction('docker_image_delete_failed', $server, [
                'action' => 'delete_image',
                'image_id' => $imageId,
                'error' => $e->getMessage(),
            ]);
            
            return response()->json([
                'error' => 'Failed to delete Docker image: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Prune unused Docker images
     */
    public function pruneImages(Request $request, Server $server)
    {
        // Check if user has Docker maintenance write permission for this server (destructive action)
        if (!auth()->user()->hasServerPermission($server, 'docker_maintenance_write')) {
            AuditLogService::logAccessDenied('docker_images_prune', [
                'server_id' => $server->id,
                'server_name' => $server->display_name,
            ]);
            abort(403, 'You do not have permission to prune Docker images on this server.');
        }

        try {
            $response = $this->agentClient->post($server, 'api/v1/docker/images/prune');
            
            $queryParams = [];
            if ($request->has('dangling')) {
                $queryParams['dangling'] = $request->get('dangling');
            }
            if ($request->has('until')) {
                $queryParams['until'] = $request->get('until');
            }
            
            if (!empty($queryParams)) {
                $url .= '?' . http_build_query($queryParams);
            }
            $result = $this->agentClient->getJsonData($response);
            
            AuditLogService::logServerAction('docker_images_pruned', $server, [
                'action' => 'prune_images',
                'space_reclaimed' => $result['space_reclaimed'] ?? 0,
                'images_deleted' => count($result['images_deleted'] ?? []),
                'dangling_only' => $request->get('dangling', 'true') === 'true',
            ]);

            return response()->json($result);
        } catch (\Exception $e) {
            AuditLogService::logServerAction('docker_images_prune_failed', $server, [
                'action' => 'prune_images',
                'error' => $e->getMessage(),
            ]);
            
            return response()->json([
                'error' => 'Failed to prune Docker images: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * List Docker volumes for a server
     */
    public function listVolumes(Request $request, Server $server)
    {
        // Check if user has Docker maintenance read permission for this server
        if (!auth()->user()->hasServerPermission($server, 'docker_maintenance_read')) {
            AuditLogService::logAccessDenied('docker_volumes_list', [
                'server_id' => $server->id,
                'server_name' => $server->display_name,
            ]);
            abort(403, 'You do not have permission to view Docker volumes on this server.');
        }

        try {
            $response = $this->agentClient->get($server, 'api/v1/docker/volumes');
            $volumes = $this->agentClient->getJsonData($response);
            
            AuditLogService::logServerAction('docker_volumes_viewed', $server, [
                'action' => 'list_volumes',
                'volume_count' => count($volumes),
            ]);

            return response()->json($volumes);
        } catch (\Exception $e) {
            AuditLogService::logServerAction('docker_volumes_list_failed', $server, [
                'action' => 'list_volumes',
                'error' => $e->getMessage(),
            ]);
            
            return response()->json([
                'error' => 'Failed to fetch Docker volumes: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Delete a Docker volume
     */
    public function deleteVolume(Request $request, Server $server, string $volumeName)
    {
        // Check if user has Docker maintenance write permission for this server (destructive action)
        if (!auth()->user()->hasServerPermission($server, 'docker_maintenance_write')) {
            AuditLogService::logAccessDenied('docker_volume_delete', [
                'server_id' => $server->id,
                'server_name' => $server->display_name,
                'volume_name' => $volumeName,
            ]);
            abort(403, 'You do not have permission to delete Docker volumes on this server.');
        }

        try {
            $response = $this->agentClient->delete($server, 'api/v1/docker/volumes/' . urlencode($volumeName));
            
            // Add query parameters
            $queryParams = [];
            if ($request->has('force')) {
                $queryParams['force'] = $request->boolean('force') ? 'true' : 'false';
            }
            
            if (!empty($queryParams)) {
                $url .= '?' . http_build_query($queryParams);
            }
            $result = $this->agentClient->getJsonData($response);
            
            AuditLogService::logServerAction('docker_volume_deleted', $server, [
                'action' => 'delete_volume',
                'volume_name' => $volumeName,
                'force' => $request->boolean('force'),
            ]);

            return response()->json($result);
        } catch (\Exception $e) {
            AuditLogService::logServerAction('docker_volume_delete_failed', $server, [
                'action' => 'delete_volume',
                'volume_name' => $volumeName,
                'error' => $e->getMessage(),
            ]);
            
            return response()->json([
                'error' => 'Failed to delete Docker volume: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Prune unused Docker volumes
     */
    public function pruneVolumes(Request $request, Server $server)
    {
        // Check if user has Docker maintenance write permission for this server (destructive action)
        if (!auth()->user()->hasServerPermission($server, 'docker_maintenance_write')) {
            AuditLogService::logAccessDenied('docker_volumes_prune', [
                'server_id' => $server->id,
                'server_name' => $server->display_name,
            ]);
            abort(403, 'You do not have permission to prune Docker volumes on this server.');
        }

        try {
            $response = $this->agentClient->post($server, 'api/v1/docker/volumes/prune');
            $result = $this->agentClient->getJsonData($response);
            
            AuditLogService::logServerAction('docker_volumes_pruned', $server, [
                'action' => 'prune_volumes',
                'space_reclaimed' => $result['space_reclaimed'] ?? 0,
                'volumes_deleted' => count($result['images_deleted'] ?? []), // Note: reusing field name from berth-agent
            ]);

            return response()->json($result);
        } catch (\Exception $e) {
            AuditLogService::logServerAction('docker_volumes_prune_failed', $server, [
                'action' => 'prune_volumes',
                'error' => $e->getMessage(),
            ]);
            
            return response()->json([
                'error' => 'Failed to prune Docker volumes: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * List Docker networks for a server
     */
    public function listNetworks(Request $request, Server $server)
    {
        // Check if user has Docker maintenance read permission for this server
        if (!auth()->user()->hasServerPermission($server, 'docker_maintenance_read')) {
            AuditLogService::logAccessDenied('docker_networks_list', [
                'server_id' => $server->id,
                'server_name' => $server->display_name,
            ]);
            abort(403, 'You do not have permission to view Docker networks on this server.');
        }

        try {
            $response = $this->agentClient->get($server, 'api/v1/docker/networks');
            $networks = $this->agentClient->getJsonData($response);
            
            AuditLogService::logServerAction('docker_networks_viewed', $server, [
                'action' => 'list_networks',
                'network_count' => count($networks),
            ]);

            return response()->json($networks);
        } catch (\Exception $e) {
            AuditLogService::logServerAction('docker_networks_list_failed', $server, [
                'action' => 'list_networks',
                'error' => $e->getMessage(),
            ]);
            
            return response()->json([
                'error' => 'Failed to fetch Docker networks: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Delete a Docker network
     */
    public function deleteNetwork(Request $request, Server $server, string $networkId)
    {
        // Check if user has Docker maintenance write permission for this server (destructive action)
        if (!auth()->user()->hasServerPermission($server, 'docker_maintenance_write')) {
            AuditLogService::logAccessDenied('docker_network_delete', [
                'server_id' => $server->id,
                'server_name' => $server->display_name,
                'network_id' => $networkId,
            ]);
            abort(403, 'You do not have permission to delete Docker networks on this server.');
        }

        try {
            $response = $this->agentClient->delete($server, 'api/v1/docker/networks/' . urlencode($networkId));
            $result = $this->agentClient->getJsonData($response);
            
            AuditLogService::logServerAction('docker_network_deleted', $server, [
                'action' => 'delete_network',
                'network_id' => $networkId,
            ]);

            return response()->json($result);
        } catch (\Exception $e) {
            AuditLogService::logServerAction('docker_network_delete_failed', $server, [
                'action' => 'delete_network',
                'network_id' => $networkId,
                'error' => $e->getMessage(),
            ]);
            
            return response()->json([
                'error' => 'Failed to delete Docker network: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Prune unused Docker networks
     */
    public function pruneNetworks(Request $request, Server $server)
    {
        // Check if user has Docker maintenance write permission for this server (destructive action)
        if (!auth()->user()->hasServerPermission($server, 'docker_maintenance_write')) {
            AuditLogService::logAccessDenied('docker_networks_prune', [
                'server_id' => $server->id,
                'server_name' => $server->display_name,
            ]);
            abort(403, 'You do not have permission to prune Docker networks on this server.');
        }

        try {
            $response = $this->agentClient->post($server, 'api/v1/docker/networks/prune');
            $result = $this->agentClient->getJsonData($response);
            
            AuditLogService::logServerAction('docker_networks_pruned', $server, [
                'action' => 'prune_networks',
                'networks_deleted' => count($result['images_deleted'] ?? []), // Note: reusing field name from berth-agent
            ]);

            return response()->json($result);
        } catch (\Exception $e) {
            AuditLogService::logServerAction('docker_networks_prune_failed', $server, [
                'action' => 'prune_networks',
                'error' => $e->getMessage(),
            ]);
            
            return response()->json([
                'error' => 'Failed to prune Docker networks: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Prune Docker build cache
     */
    public function pruneBuildCache(Request $request, Server $server)
    {
        // Check if user has Docker maintenance write permission for this server (destructive action)
        if (!auth()->user()->hasServerPermission($server, 'docker_maintenance_write')) {
            AuditLogService::logAccessDenied('docker_buildcache_prune', [
                'server_id' => $server->id,
                'server_name' => $server->display_name,
            ]);
            abort(403, 'You do not have permission to prune Docker build cache on this server.');
        }

        try {
            $response = $this->agentClient->post($server, 'api/v1/docker/buildcache/prune');
            
            $queryParams = [];
            if ($request->has('all')) {
                $queryParams['all'] = $request->boolean('all') ? 'true' : 'false';
            }
            if ($request->has('keep-storage')) {
                $queryParams['keep-storage'] = $request->get('keep-storage');
            }
            
            if (!empty($queryParams)) {
                $url .= '?' . http_build_query($queryParams);
            }
            $result = $this->agentClient->getJsonData($response);
            
            AuditLogService::logServerAction('docker_buildcache_pruned', $server, [
                'action' => 'prune_buildcache',
                'space_reclaimed' => $result['space_reclaimed'] ?? 0,
                'all_cache' => $request->boolean('all'),
                'keep_storage' => $request->get('keep-storage'),
            ]);

            return response()->json($result);
        } catch (\Exception $e) {
            AuditLogService::logServerAction('docker_buildcache_prune_failed', $server, [
                'action' => 'prune_buildcache',
                'error' => $e->getMessage(),
            ]);
            
            return response()->json([
                'error' => 'Failed to prune Docker build cache: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * System-wide Docker prune
     */
    public function systemPrune(Request $request, Server $server)
    {
        // Check if user has Docker maintenance write permission for this server (destructive action)
        if (!auth()->user()->hasServerPermission($server, 'docker_maintenance_write')) {
            AuditLogService::logAccessDenied('docker_system_prune', [
                'server_id' => $server->id,
                'server_name' => $server->display_name,
            ]);
            abort(403, 'You do not have permission to perform system prune on this server.');
        }

        try {
            $response = $this->agentClient->post($server, 'api/v1/docker/system/prune');
            
            $queryParams = [];
            if ($request->has('all')) {
                $queryParams['all'] = $request->boolean('all') ? 'true' : 'false';
            }
            if ($request->has('volumes')) {
                $queryParams['volumes'] = $request->boolean('volumes') ? 'true' : 'false';
            }
            
            if (!empty($queryParams)) {
                $url .= '?' . http_build_query($queryParams);
            }
            $result = $this->agentClient->getJsonData($response);
            
            AuditLogService::logServerAction('docker_system_pruned', $server, [
                'action' => 'system_prune',
                'space_reclaimed' => $result['space_reclaimed'] ?? 0,
                'containers_deleted' => count($result['containers_deleted'] ?? []),
                'images_deleted' => count($result['images_deleted'] ?? []),
                'networks_deleted' => count($result['networks_deleted'] ?? []),
                'volumes_deleted' => count($result['volumes_deleted'] ?? []),
                'all' => $request->boolean('all'),
                'volumes' => $request->boolean('volumes'),
            ]);

            return response()->json($result);
        } catch (\Exception $e) {
            AuditLogService::logServerAction('docker_system_prune_failed', $server, [
                'action' => 'system_prune',
                'error' => $e->getMessage(),
            ]);
            
            return response()->json([
                'error' => 'Failed to perform Docker system prune: ' . $e->getMessage()
            ], 500);
        }
    }
}