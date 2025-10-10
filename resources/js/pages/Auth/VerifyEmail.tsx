import { useForm, Head, Link } from '@inertiajs/react';
import { FormEventHandler } from 'react';
import Layout from '../../components/layout/Layout';
import FlashMessages from '../../components/FlashMessages';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';

interface VerifyEmailProps {
  token: string;
  csrfToken?: string;
}

export default function VerifyEmail({ token, csrfToken }: VerifyEmailProps) {
  const { post, processing } = useForm();

  const verify: FormEventHandler = (e) => {
    e.preventDefault();
    post(`/auth/verify-email?token=${token}`, {
      headers: {
        'X-CSRF-Token': csrfToken || '',
      },
    });
  };

  return (
    <Layout>
      <Head title="Verify Email" />
      <div className="min-h-full flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <h2 className={cn('mt-6 text-center text-3xl font-extrabold', theme.text.strong)}>
            Verify Your Email
          </h2>
          <p className={cn('mt-2 text-center text-sm', theme.text.muted)}>
            Click the button below to verify your email address
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className={theme.cards.auth}>
            <FlashMessages className="mb-4" />

            <form onSubmit={verify}>
              <div>
                <button
                  type="submit"
                  disabled={processing}
                  className={cn('w-full flex justify-center', theme.buttons.primary)}
                >
                  {processing ? 'Verifying...' : 'Verify Email Address'}
                </button>
              </div>
            </form>

            <div className="mt-6">
              <div className="text-center">
                <p className={cn('text-sm', theme.text.muted)}>
                  Need a new verification link?{' '}
                  <Link
                    href="/auth/login"
                    className={cn('font-medium transition-colors', theme.link.primary)}
                  >
                    Go back to login
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
