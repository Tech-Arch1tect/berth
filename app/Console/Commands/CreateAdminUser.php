<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;

class CreateAdminUser extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'create:admin-user {--name=} {--email=} {--password=}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Create a new admin user';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Creating a new admin user...');

        // Get user input
        $name = $this->option('name') ?: $this->ask('Enter the user\'s name');
        $email = $this->option('email') ?: $this->ask('Enter the user\'s email address');
        $password = $this->option('password') ?: $this->secret('Enter the user\'s password');

        // Validate input
        $validator = Validator::make([
            'name' => $name,
            'email' => $email,
            'password' => $password,
        ], [
            'name' => 'required|string|max:255',
            'email' => 'required|string|lowercase|email|max:255|unique:users',
            'password' => 'required|string|min:8',
        ]);

        if ($validator->fails()) {
            $this->error('Validation failed:');
            foreach ($validator->errors()->all() as $error) {
                $this->error('  - ' . $error);
            }
            return self::FAILURE;
        }

        // Check if user already exists
        if (User::where('email', $email)->exists()) {
            $this->error('A user with this email address already exists.');
            return self::FAILURE;
        }

        try {
            // Create the user
            $user = User::create([
                'name' => $name,
                'email' => $email,
                'password' => Hash::make($password),
                'email_verified_at' => now(), // Auto-verify admin users
            ]);

            // Assign admin role
            $user->assignRole('admin');

            $this->info('Admin user created successfully!');
            $this->table(
                ['Field', 'Value'],
                [
                    ['Name', $user->name],
                    ['Email', $user->email],
                    ['Role', 'admin'],
                    ['Email Verified', 'Yes'],
                    ['Created At', $user->created_at->format('Y-m-d H:i:s')],
                ]
            );

            return self::SUCCESS;
        } catch (\Exception $e) {
            $this->error('Failed to create admin user: ' . $e->getMessage());
            return self::FAILURE;
        }
    }
}
