<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\AuditLog;
use Carbon\Carbon;

class CleanupAuditLogs extends Command
{
    protected $signature = 'audit:cleanup {--dry-run : Show what would be deleted without actually deleting}';
    protected $description = 'Clean up old audit log records based on retention settings';

    public function handle()
    {
        $retentionDays = config('audit.retention_days', 0);
        
        if ($retentionDays <= 0) {
            $this->info('Audit log retention is disabled (retention_days is 0). No cleanup performed.');
            return 0;
        }

        $cutoffDate = Carbon::now()->subDays($retentionDays);
        
        $count = AuditLog::where('created_at', '<', $cutoffDate)->count();
        
        if ($count === 0) {
            $this->info("No audit logs older than {$retentionDays} days found.");
            return 0;
        }

        if ($this->option('dry-run')) {
            $this->info("DRY RUN: Would delete {$count} audit log records older than {$cutoffDate->format('Y-m-d H:i:s')}");
            
            $sampleRecords = AuditLog::where('created_at', '<', $cutoffDate)
                ->orderBy('created_at', 'desc')
                ->limit(5)
                ->get(['id', 'event', 'created_at', 'user_email']);
                
            if ($sampleRecords->isNotEmpty()) {
                $this->info('Sample records that would be deleted:');
                $this->table(
                    ['ID', 'Event', 'Created At', 'User Email'],
                    $sampleRecords->map(function ($record) {
                        return [
                            $record->id,
                            $record->event,
                            $record->created_at->format('Y-m-d H:i:s'),
                            $record->user_email ?: 'N/A',
                        ];
                    })->toArray()
                );
            }
            
            return 0;
        }

        if ($this->input->isInteractive()) {
            if (!$this->confirm("Delete {$count} audit log records older than {$retentionDays} days?")) {
                $this->info('Operation cancelled.');
                return 0;
            }
        }

        $startTime = microtime(true);
        $deletedCount = AuditLog::where('created_at', '<', $cutoffDate)->delete();
        $executionTime = round((microtime(true) - $startTime) * 1000, 2);

        $this->info("Successfully deleted {$deletedCount} audit log records in {$executionTime}ms.");
        
        AuditLog::createLog([
            'event' => 'audit_cleanup',
            'metadata' => [
                'retention_days' => $retentionDays,
                'cutoff_date' => $cutoffDate->toISOString(),
                'records_deleted' => $deletedCount,
                'execution_time_ms' => $executionTime,
            ],
        ]);

        return 0;
    }
}