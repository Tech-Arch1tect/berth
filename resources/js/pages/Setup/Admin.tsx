import React from 'react';
import { Head, useForm } from '@inertiajs/react';
import Layout from '../../components/layout/Layout';
import FlashMessages from '../../components/FlashMessages';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';

interface FormData {
  username: string;
  email: string;
  password: string;
  password_confirm: string;
}

export default function AdminSetup() {
  const { data, setData, post, processing, errors } = useForm<FormData>({
    username: '',
    email: '',
    password: '',
    password_confirm: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    post('/setup/admin');
  };

  return (
    <Layout>
      <Head title="Admin Setup" />

      <div
        className={cn(
          'min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8',
          theme.layout.authShell
        )}
      >
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className={cn('mt-6 text-center text-3xl font-extrabold', theme.text.strong)}>
              Create Admin Account
            </h2>
            <p className={cn('mt-2 text-center text-sm', theme.text.muted)}>
              Set up your first admin account to get started
            </p>
          </div>

          <FlashMessages />

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="rounded-md shadow-sm -space-y-px">
              <div>
                <label htmlFor="username" className="sr-only">
                  Username
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  className={cn(theme.forms.input, 'rounded-none rounded-t-md')}
                  placeholder="Username"
                  value={data.username}
                  onChange={(e) => setData('username', e.target.value)}
                />
                {errors.username && (
                  <p className={cn('mt-1 text-sm', theme.text.danger)}>{errors.username}</p>
                )}
              </div>

              <div>
                <label htmlFor="email" className="sr-only">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className={cn(theme.forms.input, 'rounded-none')}
                  placeholder="Email"
                  value={data.email}
                  onChange={(e) => setData('email', e.target.value)}
                />
                {errors.email && (
                  <p className={cn('mt-1 text-sm', theme.text.danger)}>{errors.email}</p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="sr-only">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className={cn(theme.forms.input, 'rounded-none')}
                  placeholder="Password"
                  value={data.password}
                  onChange={(e) => setData('password', e.target.value)}
                />
                {errors.password && (
                  <p className={cn('mt-1 text-sm', theme.text.danger)}>{errors.password}</p>
                )}
              </div>

              <div>
                <label htmlFor="password_confirm" className="sr-only">
                  Confirm Password
                </label>
                <input
                  id="password_confirm"
                  name="password_confirm"
                  type="password"
                  required
                  className={cn(theme.forms.input, 'rounded-none rounded-b-md')}
                  placeholder="Confirm Password"
                  value={data.password_confirm}
                  onChange={(e) => setData('password_confirm', e.target.value)}
                />
                {errors.password_confirm && (
                  <p className={cn('mt-1 text-sm', theme.text.danger)}>{errors.password_confirm}</p>
                )}
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={processing}
                className={cn(
                  'w-full flex justify-center',
                  theme.buttons.primary,
                  processing && 'opacity-50 cursor-not-allowed'
                )}
              >
                {processing ? 'Creating Admin...' : 'Create Admin Account'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
}
