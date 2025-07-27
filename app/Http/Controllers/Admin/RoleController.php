<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\Server;
use Illuminate\Http\Request;
use Inertia\Inertia;

class RoleController extends Controller
{
    public function index()
    {
        $roles = Role::with('servers')->get();
        
        return Inertia::render('Admin/Roles/Index', [
            'roles' => $roles,
        ]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255|unique:roles',
        ]);

        Role::create([
            'name' => $request->name,
            'guard_name' => 'web',
        ]);

        return back()->with('success', 'Role created successfully.');
    }

    public function update(Request $request, Role $role)
    {
        $request->validate([
            'name' => 'required|string|max:255|unique:roles,name,' . $role->id,
        ]);

        $role->update([
            'name' => $request->name,
        ]);

        return back()->with('success', 'Role updated successfully.');
    }

    public function destroy(Role $role)
    {
        if ($role->name === 'admin') {
            return back()->withErrors(['error' => 'Cannot delete admin role.']);
        }

        $role->delete();

        return back()->with('success', 'Role deleted successfully.');
    }

    public function permissions(Role $role)
    {
        $role->load('servers');
        $allServers = Server::all();
        
        $roleServers = $role->getServersWithPermissions();
        
        return Inertia::render('Admin/Roles/Permissions', [
            'role' => $role,
            'roleServers' => $roleServers,
            'allServers' => $allServers,
        ]);
    }

    public function updatePermissions(Request $request, Role $role)
    {
        $request->validate([
            'serverPermissions' => 'required|array',
            'serverPermissions.*.server_id' => 'required|exists:servers,id',
            'serverPermissions.*.permissions' => 'required|array',
            'serverPermissions.*.permissions.access' => 'boolean',
            'serverPermissions.*.permissions.filemanager_access' => 'boolean',
            'serverPermissions.*.permissions.filemanager_write' => 'boolean',
            'serverPermissions.*.permissions.start-stop' => 'boolean',
            'serverPermissions.*.permissions.exec' => 'boolean',
            'serverPermissions.*.permissions.docker_maintenance_read' => 'boolean',
            'serverPermissions.*.permissions.docker_maintenance_write' => 'boolean',
        ]);

        // Clear existing permissions for this role
        $role->servers()->detach();

        // Add new permissions
        foreach ($request->serverPermissions as $serverPermission) {
            $permissions = $serverPermission['permissions'];
            
            if ($permissions['filemanager_access'] && !$permissions['access']) {
                return back()->withErrors(['error' => 'File Manager access requires basic Access permission.']);
            }
            if ($permissions['filemanager_write'] && (!$permissions['access'] || !$permissions['filemanager_access'])) {
                return back()->withErrors(['error' => 'File Edit requires both Access and File Manager permissions.']);
            }
            if ($permissions['start-stop'] && !$permissions['access']) {
                return back()->withErrors(['error' => 'Up/Down control requires basic Access permission.']);
            }
            if ($permissions['exec'] && !$permissions['access']) {
                return back()->withErrors(['error' => 'Exec commands require basic Access permission.']);
            }
            if ($permissions['docker_maintenance_read'] && !$permissions['access']) {
                return back()->withErrors(['error' => 'Docker Read requires basic Access permission.']);
            }
            if ($permissions['docker_maintenance_write'] && (!$permissions['access'] || !$permissions['docker_maintenance_read'])) {
                return back()->withErrors(['error' => 'Docker Write requires both Access and Docker Read permissions.']);
            }
            
            // Only attach if at least one permission is granted
            if ($permissions['access'] || $permissions['filemanager_access'] || $permissions['filemanager_write'] || $permissions['start-stop'] || $permissions['exec'] || $permissions['docker_maintenance_read'] || $permissions['docker_maintenance_write']) {
                $role->servers()->attach($serverPermission['server_id'], [
                    'can_access' => $permissions['access'],
                    'can_filemanager_access' => $permissions['filemanager_access'],
                    'can_filemanager_write' => $permissions['filemanager_write'],
                    'can_start_stop' => $permissions['start-stop'],
                    'can_exec' => $permissions['exec'],
                    'can_docker_maintenance_read' => $permissions['docker_maintenance_read'],
                    'can_docker_maintenance_write' => $permissions['docker_maintenance_write'],
                ]);
            }
        }

        return back()->with('success', 'Role permissions updated successfully.');
    }
}