<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Server;
use App\Models\User;
use App\Services\AuditLogExportService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class AuditLogController extends Controller
{
    public function index(Request $request)
    {
        $query = AuditLog::with(['user', 'server'])
            ->orderBy('created_at', 'desc');

        if ($request->filled('event')) {
            $query->where('event', $request->event);
        }

        if ($request->filled('user_id')) {
            $query->where('user_id', $request->user_id);
        }

        if ($request->filled('server_id')) {
            $query->where('server_id', $request->server_id);
        }

        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->date_to);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('url', 'like', "%{$search}%")
                  ->orWhere('user_email', 'like', "%{$search}%")
                  ->orWhere('user_name', 'like', "%{$search}%")
                  ->orWhere('stack_name', 'like', "%{$search}%")
                  ->orWhere('ip_address', 'like', "%{$search}%");
            });
        }

        $auditLogs = $query->paginate(config('audit.per_page', 50))->withQueryString();

        $events = AuditLog::select('event')
            ->distinct()
            ->orderBy('event')
            ->pluck('event')
            ->map(function ($event) {
                return [
                    'value' => $event,
                    'label' => ucfirst(str_replace('_', ' ', $event))
                ];
            });

        $users = User::select('id', 'name', 'email')
            ->orderBy('name')
            ->get()
            ->map(function ($user) {
                return [
                    'value' => $user->id,
                    'label' => "{$user->name} ({$user->email})"
                ];
            });

        $servers = Server::select('id', 'display_name')
            ->orderBy('display_name')
            ->get()
            ->map(function ($server) {
                return [
                    'value' => $server->id,
                    'label' => $server->display_name
                ];
            });

        return Inertia::render('Admin/AuditLogs/Index', [
            'auditLogs' => $auditLogs,
            'filters' => [
                'event' => $request->event,
                'user_id' => $request->user_id,
                'server_id' => $request->server_id,
                'date_from' => $request->date_from,
                'date_to' => $request->date_to,
                'search' => $request->search,
            ],
            'filterOptions' => [
                'events' => $events,
                'users' => $users,
                'servers' => $servers,
            ],
        ]);
    }

    public function show(AuditLog $auditLog)
    {
        $auditLog->load(['user', 'server']);
        
        return Inertia::render('Admin/AuditLogs/Show', [
            'auditLog' => $auditLog,
        ]);
    }

    public function export(Request $request, AuditLogExportService $exportService)
    {
        try {
            $export = $exportService->exportToCsv($request);
            
            return response($export['content'])
                ->header('Content-Type', 'text/csv; charset=utf-8')
                ->header('Content-Disposition', 'attachment; filename="' . $export['filename'] . '"');
                
        } catch (\Exception $e) {
            return back()->withErrors(['error' => 'Failed to export audit logs: ' . $e->getMessage()]);
        }
    }
}
