<?php

namespace App\Services;

use App\Models\AuditLog;
use Illuminate\Http\Request;

class AuditLogExportService
{
    public function exportToCsv(Request $request): array
    {
        $query = $this->buildFilteredQuery($request);
        $auditLogs = $query->limit(config('audit.export_limit', 10000))->get();
        
        $csvContent = $this->generateCsvContent($auditLogs);
        $filename = 'audit-logs-' . now()->format('Y-m-d-H-i-s') . '.csv';
        
        return [
            'content' => $csvContent,
            'filename' => $filename,
            'count' => $auditLogs->count()
        ];
    }
    
    private function buildFilteredQuery(Request $request)
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

        return $query;
    }
    
    private function generateCsvContent($auditLogs): string
    {
        $csvContent = "Timestamp,Event,User,Email,Server,Stack,URL,Method,IP Address,User Agent,Old Values,New Values,Metadata\n";
        
        foreach ($auditLogs as $log) {
            $values = [
                $log->created_at->format('Y-m-d H:i:s'),
                $log->event,
                $log->user_name ?: '',
                $log->user_email ?: '',
                $log->server ? $log->server->display_name : '',
                $log->stack_name ?: '',
                $log->url,
                $log->method,
                $log->ip_address ?: '',
                $this->sanitizeForCsv($log->user_agent ?: ''),
                $log->old_values ? $this->sanitizeForCsv(json_encode($log->old_values)) : '',
                $log->new_values ? $this->sanitizeForCsv(json_encode($log->new_values)) : '',
                $log->metadata ? $this->sanitizeForCsv(json_encode($log->metadata)) : ''
            ];
            
            $escapedValues = array_map([$this, 'escapeCsvValue'], $values);
            $csvContent .= implode(',', $escapedValues) . "\n";
        }
        
        return $csvContent;
    }
    
    private function sanitizeForCsv(string $value): string
    {
        return str_replace(["\r", "\n", "\t"], ' ', $value);
    }
    
    private function escapeCsvValue(string $value): string
    {
        if (strpos($value, ',') !== false || strpos($value, '"') !== false || strpos($value, "\n") !== false) {
            return '"' . str_replace('"', '""', $value) . '"';
        }
        return $value;
    }
}