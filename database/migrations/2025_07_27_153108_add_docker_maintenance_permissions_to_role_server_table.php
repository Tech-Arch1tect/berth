<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('role_server', function (Blueprint $table) {
            $table->boolean('can_docker_maintenance_read')->default(false)->after('can_exec');
            $table->boolean('can_docker_maintenance_write')->default(false)->after('can_docker_maintenance_read');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('role_server', function (Blueprint $table) {
            $table->dropColumn(['can_docker_maintenance_read', 'can_docker_maintenance_write']);
        });
    }
};
