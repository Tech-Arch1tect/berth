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
            // Rename existing columns
            $table->renameColumn('can_read', 'can_access');
            $table->renameColumn('can_write', 'can_filemanager_write');
            
            // Add new filemanager_access permission
            $table->boolean('can_filemanager_access')->default(false)->after('can_access');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('role_server', function (Blueprint $table) {
            // Remove new column
            $table->dropColumn('can_filemanager_access');
            
            // Rename columns back
            $table->renameColumn('can_access', 'can_read');
            $table->renameColumn('can_filemanager_write', 'can_write');
        });
    }
};
