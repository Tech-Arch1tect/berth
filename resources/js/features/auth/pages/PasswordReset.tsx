import { FormEvent, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { isApiError } from '../../../api/client';
import { usePostApiV1AuthPasswordReset } from '../../../api/generated/auth/auth';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { fieldErrorsFromApiError } from '../../../shared/utils/api-errors';
import { showToast } from '../../../shared/utils/toast';
import { cn } from '../../../shared/utils/cn';
import { theme } from '../../../shared/theme';

export default function PasswordReset() {
  useDocumentTitle('Password Reset');
  const mutation = usePostApiV1AuthPasswordReset();
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    try {
      await mutation.mutateAsync({ data: { email } });
      showToast.success('If that account exists, a reset link has been sent.');
      setEmail('');
    } catch (err) {
      setErrors(fieldErrorsFromApiError(err));
      const message =
        isApiError(err) && (err.data as { error?: { message?: string } })?.error?.message
          ? (err.data as { error: { message: string } }).error.message
          : 'Could not request a password reset. Please try again.';
      showToast.error(message);
    }
  };

  return (
    <div className="min-h-full flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className={cn('mt-6 text-center text-3xl font-extrabold', theme.text.strong)}>
            Reset your password
          </h2>
          <p className={cn('mt-2 text-center text-sm', theme.text.muted)}>
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="sr-only">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className={theme.forms.input}
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {errors.email && (
              <p className={cn('mt-1 text-sm', theme.text.danger)}>{errors.email}</p>
            )}
          </div>

          <div>
            <button
              type="submit"
              disabled={mutation.isPending}
              className={cn('w-full flex justify-center', theme.buttons.primary)}
            >
              {mutation.isPending ? 'Sending...' : 'Send reset link'}
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
