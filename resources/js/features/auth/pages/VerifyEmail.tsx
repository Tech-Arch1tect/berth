import { FormEventHandler, useState } from 'react';
import { Link, useSearch } from '@tanstack/react-router';
import { isApiError } from '../../../api/client';
import { usePostApiV1AuthVerifyEmail } from '../../../api/generated/auth/auth';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { showToast } from '../../../shared/utils/toast';
import { cn } from '../../../shared/utils/cn';
import { theme } from '../../../shared/theme';

export default function VerifyEmail() {
  useDocumentTitle('Verify Email');
  const search = useSearch({ strict: false }) as { token?: string };
  const token = search.token ?? '';
  const mutation = usePostApiV1AuthVerifyEmail();
  const [verified, setVerified] = useState(false);

  const verify: FormEventHandler = async (e) => {
    e.preventDefault();
    if (!token) {
      showToast.error('Verification link is missing the token.');
      return;
    }
    try {
      await mutation.mutateAsync({ data: { token } });
      setVerified(true);
      showToast.success('Email verified successfully.');
    } catch (err) {
      const message =
        isApiError(err) && (err.data as { error?: { message?: string } })?.error?.message
          ? (err.data as { error: { message: string } }).error.message
          : 'Could not verify your email. The link may have expired.';
      showToast.error(message);
    }
  };

  return (
    <div className="min-h-full flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className={cn('mt-6 text-center text-3xl font-extrabold', theme.text.strong)}>
          Verify Your Email
        </h2>
        <p className={cn('mt-2 text-center text-sm', theme.text.muted)}>
          {verified
            ? 'Your email is now verified. You can sign in below.'
            : 'Click the button below to verify your email address.'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className={theme.cards.auth}>
          {!verified && (
            <form onSubmit={verify}>
              <button
                type="submit"
                disabled={mutation.isPending || !token}
                className={cn('w-full flex justify-center', theme.buttons.primary)}
              >
                {mutation.isPending ? 'Verifying...' : 'Verify Email Address'}
              </button>
            </form>
          )}

          <div className="mt-6">
            <div className="text-center">
              <p className={cn('text-sm', theme.text.muted)}>
                {verified ? 'Ready to sign in?' : 'Need a new verification link?'}{' '}
                <Link
                  to="/auth/login"
                  className={cn('font-medium transition-colors', theme.link.primary)}
                >
                  Go to login
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
