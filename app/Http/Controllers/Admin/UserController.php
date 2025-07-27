<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Role;
use App\Services\AuditLogService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules;
use Inertia\Inertia;

class UserController extends Controller
{
    public function index()
    {
        $users = User::with('roles')->get();
        $roles = Role::all();
        
        return Inertia::render('Admin/Users/Index', [
            'users' => $users,
            'roles' => $roles,
        ]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|lowercase|email|max:255|unique:'.User::class,
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
            'roles' => 'array',
            'roles.*' => 'exists:roles,name',
            'email_verified' => 'boolean',
        ]);

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'email_verified_at' => $request->email_verified ? now() : null,
        ]);

        // Assign roles if provided
        if ($request->roles) {
            $user->assignRole($request->roles);
            
            AuditLogService::logUserAction('role_assigned', $user, [
                'roles' => $request->roles,
            ]);
        }

        AuditLogService::logUserAction('user_created', $user, [
            'email' => $user->email,
            'email_verified' => $request->email_verified ? 'yes' : 'no',
        ]);

        return back()->with('success', 'User created successfully.');
    }

    public function updateRoles(Request $request, User $user)
    {
        $request->validate([
            'roles' => 'array',
            'roles.*' => 'exists:roles,name',
        ]);

        // Prevent removing admin role from the last admin
        if ($user->hasRole('admin') && !in_array('admin', $request->roles ?? [])) {
            $adminCount = User::role('admin')->count();
            if ($adminCount <= 1) {
                return back()->withErrors(['error' => 'Cannot remove admin role from the last admin user.']);
            }
        }

        $oldRoles = $user->roles->pluck('name')->toArray();
        $user->syncRoles($request->roles ?? []);
        $newRoles = $request->roles ?? [];

        AuditLogService::logUserAction('user_updated', $user, [
            'action' => 'roles_updated',
            'old_roles' => $oldRoles,
            'new_roles' => $newRoles,
        ]);

        $addedRoles = array_diff($newRoles, $oldRoles);
        $removedRoles = array_diff($oldRoles, $newRoles);

        foreach ($addedRoles as $role) {
            AuditLogService::logUserAction('role_assigned', $user, [
                'role' => $role,
            ]);
        }

        foreach ($removedRoles as $role) {
            AuditLogService::logUserAction('role_removed', $user, [
                'role' => $role,
            ]);
        }

        return back()->with('success', 'User roles updated successfully.');
    }

    public function destroy(User $user)
    {
        // Prevent deleting the last admin
        if ($user->hasRole('admin')) {
            $adminCount = User::role('admin')->count();
            if ($adminCount <= 1) {
                return back()->withErrors(['error' => 'Cannot delete the last admin user.']);
            }
        }

        AuditLogService::logUserAction('user_deleted', $user, [
            'email' => $user->email,
            'roles' => $user->roles->pluck('name')->toArray(),
        ]);

        $user->delete();

        return back()->with('success', 'User deleted successfully.');
    }
}