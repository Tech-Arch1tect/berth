<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\Server;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ServerPermissionController extends Controller
{
    public function index(Server $server)
    {
        $server->load('roles');
        $allRoles = Role::all();
        
        $serverRoles = $server->getRolesWithPermissions();
        
        return Inertia::render('Admin/Servers/Permissions', [
            'server' => $server,
            'serverRoles' => $serverRoles,
            'allRoles' => $allRoles,
        ]);
    }

    public function updatePermissions(Request $request, Server $server)
    {
        $request->validate([
            'rolePermissions' => 'required|array',
            'rolePermissions.*.role_id' => 'required|exists:roles,id',
            'rolePermissions.*.permissions' => 'required|array',
            'rolePermissions.*.permissions.read' => 'boolean',
            'rolePermissions.*.permissions.write' => 'boolean',
            'rolePermissions.*.permissions.start-stop' => 'boolean',
        ]);

        // Clear existing permissions for this server
        $server->roles()->detach();

        // Add new permissions
        foreach ($request->rolePermissions as $rolePermission) {
            $permissions = $rolePermission['permissions'];
            
            // Only attach if at least one permission is granted
            if ($permissions['read'] || $permissions['write'] || $permissions['start-stop']) {
                $server->roles()->attach($rolePermission['role_id'], [
                    'can_read' => $permissions['read'],
                    'can_write' => $permissions['write'],
                    'can_start_stop' => $permissions['start-stop'],
                ]);
            }
        }

        return back()->with('success', 'Server permissions updated successfully.');
    }

    public function assignRole(Request $request, Server $server)
    {
        $request->validate([
            'role_id' => 'required|exists:roles,id',
            'permissions' => 'required|array',
            'permissions.read' => 'boolean',
            'permissions.write' => 'boolean',
            'permissions.start-stop' => 'boolean',
        ]);

        $permissions = $request->permissions;

        // Check if role is already assigned to this server
        if ($server->roles()->where('role_id', $request->role_id)->exists()) {
            return back()->withErrors(['error' => 'Role is already assigned to this server.']);
        }

        // Only assign if at least one permission is granted
        if (!$permissions['read'] && !$permissions['write'] && !$permissions['start-stop']) {
            return back()->withErrors(['error' => 'At least one permission must be granted.']);
        }

        $server->roles()->attach($request->role_id, [
            'can_read' => $permissions['read'],
            'can_write' => $permissions['write'],
            'can_start_stop' => $permissions['start-stop'],
        ]);

        return back()->with('success', 'Role assigned to server successfully.');
    }

    public function removeRole(Request $request, Server $server, Role $role)
    {
        $server->roles()->detach($role->id);

        return back()->with('success', 'Role removed from server successfully.');
    }

    public function updateRolePermissions(Request $request, Server $server, Role $role)
    {
        $request->validate([
            'permissions' => 'required|array',
            'permissions.read' => 'boolean',
            'permissions.write' => 'boolean',
            'permissions.start-stop' => 'boolean',
        ]);

        $permissions = $request->permissions;

        // If no permissions are granted, remove the role from the server
        if (!$permissions['read'] && !$permissions['write'] && !$permissions['start-stop']) {
            $server->roles()->detach($role->id);
            return back()->with('success', 'Role removed from server (no permissions granted).');
        }

        // Update the permissions
        $server->roles()->updateExistingPivot($role->id, [
            'can_read' => $permissions['read'],
            'can_write' => $permissions['write'],
            'can_start_stop' => $permissions['start-stop'],
        ]);

        return back()->with('success', 'Role permissions updated successfully.');
    }
}