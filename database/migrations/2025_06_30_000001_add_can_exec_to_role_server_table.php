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
            $table->boolean('can_exec')->default(false)->after('can_start_stop');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('role_server', function (Blueprint $table) {
            $table->dropColumn('can_exec');
        });
    }
};