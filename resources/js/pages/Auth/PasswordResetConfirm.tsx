import { FormEvent } from 'react';
import { Head, useForm, Link } from '@inertiajs/react';
import FlashMessages from '../../components/FlashMessages';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';

interface Props {
  token: string;
  csrfToken?: string;
}

export default function PasswordResetConfirm({ token, csrfToken }: Props) {
  const { data, setData, post, processing, errors } = useForm({
    token: token,
    password: '',
    password_confirm: '',
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    post('/auth/password-reset/confirm', {
      headers: {
        'X-CSRF-Token': csrfToken || '',
      },
    });
  };

  return (
    <>
      <Head title="Reset Password" />

      <div className="min-h-full flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className={cn('mt-6 text-center text-3xl font-extrabold', theme.text.strong)}>
              Choose a new password
            </h2>
            <p className={cn('mt-2 text-center text-sm', theme.text.muted)}>
              Enter your new password below.
            </p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <FlashMessages />

            <input type="hidden" name="token" value={data.token} />

            <div className="space-y-4">
              <div>
                <label htmlFor="password" className="sr-only">
                  New Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  className={theme.forms.input}
                  placeholder="New password"
                  value={data.password}
                  onChange={(e) => setData('password', e.target.value)}
                />
                {errors.password && (
                  <p className={cn('mt-1 text-sm', theme.text.danger)}>{errors.password}</p>
                )}
              </div>

              <div>
                <label htmlFor="password_confirm" className="sr-only">
                  Confirm New Password
                </label>
                <input
                  id="password_confirm"
                  name="password_confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  className={theme.forms.input}
                  placeholder="Confirm new password"
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
                className={cn('w-full flex justify-center', theme.buttons.primary)}
              >
                {processing ? 'Resetting...' : 'Reset password'}
              </button>
            </div>

            <div className="text-center">
              <Link
                href="/auth/login"
                className={cn('font-medium transition-colors', theme.link.primary)}
              >
                Back to login
              </Link>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
