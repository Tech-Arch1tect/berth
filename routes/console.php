<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Schedule audit log retention cleanup to run daily at 2 AM
Schedule::command('audit:cleanup')
    ->daily()
    ->at('02:00')
    ->when(function () {
        return config('audit.retention_days', 0) > 0;
    })
    ->withoutOverlapping()
    ->runInBackground();
