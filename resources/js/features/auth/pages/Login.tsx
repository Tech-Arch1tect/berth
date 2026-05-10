import { FormEventHandler, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { isApiError } from '../../../api/client';
import { usePostApiV1AuthResendVerification } from '../../../api/generated/auth/auth';
import { useAuth } from '../../../shared/auth/auth-context';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { fieldErrorsFromApiError } from '../../../shared/utils/api-errors';
import { showToast } from '../../../shared/utils/toast';
import { cn } from '../../../shared/utils/cn';
import { theme } from '../../../shared/theme';

export default function Login() {
  useDocumentTitle('Login');
  const { login } = useAuth();
  const navigate = useNavigate();
  const resendMutation = usePostApiV1AuthResendVerification();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [resendEmail, setResendEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit: FormEventHandler = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrors({});
    try {
      const result = await login({ username, password });
      if (result.totpRequired) {
        await navigate({ to: '/auth/totp/verify' });
      } else {
        await navigate({ to: '/' });
      }
    } catch (err) {
      const fieldErrors = fieldErrorsFromApiError(err);
      setErrors(fieldErrors);
      const message =
        isApiError(err) && (err.data as { error?: { message?: string } })?.error?.message
          ? (err.data as { error: { message: string } }).error.message
          : 'Login failed. Check your username and password.';
      showToast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const submitResend: FormEventHandler = async (e) => {
    e.preventDefault();
    if (!resendEmail.trim()) return;
    try {
      await resendMutation.mutateAsync({ data: { email: resendEmail } });
      showToast.success('If that account exists and needs verification, an email is on the way.');
      setResendEmail('');
    } catch (err) {
      const message =
        isApiError(err) && (err.data as { error?: { message?: string } })?.error?.message
          ? (err.data as { error: { message: string } }).error.message
          : 'Could not request a verification email. Please try again.';
      showToast.error(message);
    }
  };

  return (
    <div className="min-h-full flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className={cn('mt-6 text-center text-3xl font-extrabold', theme.text.strong)}>
          Sign in to your account
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className={theme.cards.auth}>
          <form className="space-y-6" onSubmit={submit}>
            <div>
              <label htmlFor="username" className={cn(theme.forms.label, 'mb-2')}>
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={theme.forms.input}
                placeholder="Enter your username"
              />
              {errors.username && (
                <p className={cn('mt-2 text-sm flex items-center space-x-1', theme.text.danger)}>
                  <span>⚠️</span>
                  <span>{errors.username}</span>
                </p>
              )}
            </div>

            <div>
              <label htmlFor="password" className={cn(theme.forms.label, 'mb-2')}>
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={theme.forms.input}
                placeholder="Enter your password"
              />
              {errors.password && (
                <p className={cn('mt-2 text-sm flex items-center space-x-1', theme.text.danger)}>
                  <span>⚠️</span>
                  <span>{errors.password}</span>
                </p>
              )}
            </div>

            <div>
              <button
                type="submit"
                disabled={submitting}
                className={cn('w-full flex justify-center items-center', theme.buttons.primary)}
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                    Signing in...
                  </>
                ) : (
                  'Sign in'
                )}
              </button>
            </div>

            <div className="space-y-4 pt-6 border-t border-slate-200/50 dark:border-slate-700/50">
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => void navigate({ to: '/auth/password-reset' })}
                  className={cn(theme.link.subtle)}
                >
                  Forgot your password?
                </button>
              </div>

              <div className={cn('text-center p-4 rounded-xl', theme.intent.info.surface)}>
                <form onSubmit={submitResend} className="space-y-3">
                  <input
                    type="email"
                    name="email"
                    placeholder="Enter email to resend verification"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    className={cn('w-full text-sm', theme.forms.input)}
                  />
                  <button
                    type="submit"
                    disabled={resendMutation.isPending}
                    className={cn(theme.link.underlined)}
                  >
                    {resendMutation.isPending ? 'Sending...' : 'Resend verification email'}
                  </button>
                </form>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
