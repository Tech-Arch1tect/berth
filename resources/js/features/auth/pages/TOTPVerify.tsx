import { FormEvent, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { isApiError } from '../../../api/client';
import { useAuth } from '../../../shared/auth/auth-context';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { showToast } from '../../../shared/utils/toast';
import { cn } from '../../../shared/utils/cn';
import { theme } from '../../../shared/theme';

export default function TOTPVerify() {
  useDocumentTitle('Two-Factor Authentication');
  const navigate = useNavigate();
  const { totpPending, verifyTOTP } = useAuth();
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setCodeError(null);
    if (!totpPending) {
      showToast.error('No pending sign-in. Please log in first.');
      await navigate({ to: '/auth/login' });
      return;
    }
    setSubmitting(true);
    try {
      await verifyTOTP(code);
      await navigate({ to: '/' });
    } catch (err) {
      const message =
        isApiError(err) && (err.data as { error?: { message?: string } })?.error?.message
          ? (err.data as { error: { message: string } }).error.message
          : 'Invalid or expired code. Please try again.';
      setCodeError(message);
      showToast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className={cn('text-2xl font-bold', theme.text.strong)}>Two-Factor Authentication</h2>
        <p className={cn('mt-2 text-sm', theme.text.muted)}>
          Enter the 6-digit code from your authenticator app
        </p>
      </div>

      <form className="space-y-6" onSubmit={submit}>
        <div>
          <label htmlFor="code" className="sr-only">
            Authentication Code
          </label>
          <input
            id="code"
            name="code"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={cn('text-center text-2xl tracking-widest', theme.forms.input)}
            placeholder="123456"
            maxLength={6}
            pattern="[0-9]{6}"
            autoComplete="one-time-code"
            required
          />
          {codeError && <div className={cn('mt-2 text-sm', theme.text.danger)}>{codeError}</div>}
        </div>

        <div>
          <button
            type="submit"
            disabled={submitting}
            className={cn('w-full flex justify-center', theme.buttons.primary)}
          >
            {submitting ? 'Verifying...' : 'Verify Code'}
          </button>
        </div>

        <div className="text-center">
          <p className={cn('text-sm', theme.text.muted)}>
            Having trouble? Contact support for assistance.
          </p>
        </div>
      </form>
    </div>
  );
}
