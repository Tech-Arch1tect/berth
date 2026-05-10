import { FormEvent, useState } from 'react';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { isApiError } from '../../../api/client';
import { usePostApiV1AuthPasswordResetConfirm } from '../../../api/generated/auth/auth';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { fieldErrorsFromApiError } from '../../../shared/utils/api-errors';
import { showToast } from '../../../shared/utils/toast';
import { cn } from '../../../shared/utils/cn';
import { theme } from '../../../shared/theme';

export default function PasswordResetConfirm() {
  useDocumentTitle('Reset Password');
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { token?: string };
  const token = search.token ?? '';

  const mutation = usePostApiV1AuthPasswordResetConfirm();
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    if (password !== passwordConfirm) {
      setErrors({ password_confirm: 'Passwords do not match' });
      return;
    }
    try {
      await mutation.mutateAsync({
        data: { token, password, password_confirmation: passwordConfirm },
      });
      showToast.success('Password reset successfully. Please sign in with your new password.');
      await navigate({ to: '/auth/login' });
    } catch (err) {
      setErrors(fieldErrorsFromApiError(err));
      const message =
        isApiError(err) && (err.data as { error?: { message?: string } })?.error?.message
          ? (err.data as { error: { message: string } }).error.message
          : 'Could not reset your password. The link may have expired.';
      showToast.error(message);
    }
  };

  return (
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
              />
              {errors.password_confirm && (
                <p className={cn('mt-1 text-sm', theme.text.danger)}>{errors.password_confirm}</p>
              )}
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={mutation.isPending}
              className={cn('w-full flex justify-center', theme.buttons.primary)}
            >
              {mutation.isPending ? 'Resetting...' : 'Reset password'}
            </button>
          </div>

          <div className="text-center">
            <Link
              to="/auth/login"
              className={cn('font-medium transition-colors', theme.link.primary)}
            >
              Back to login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
