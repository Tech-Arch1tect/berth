import { FormEvent } from 'react';
import { Head, useForm, Link } from '@inertiajs/react';
import Layout from '../../components/Layout';
import FlashMessages from '../../components/FlashMessages';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';

interface Props {
  csrfToken?: string;
}

export default function PasswordReset({ csrfToken }: Props) {
  const { data, setData, post, processing, errors } = useForm({
    email: '',
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    post('/auth/password-reset', {
      headers: {
        'X-CSRF-Token': csrfToken || '',
      },
    });
  };

  return (
    <Layout>
      <Head title="Password Reset" />

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
            <FlashMessages />

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
                value={data.email}
                onChange={(e) => setData('email', e.target.value)}
              />
              {errors.email && (
                <p className={cn('mt-1 text-sm', theme.text.danger)}>{errors.email}</p>
              )}
            </div>

            <div>
              <button
                type="submit"
                disabled={processing}
                className={cn('w-full flex justify-center', theme.buttons.primary)}
              >
                {processing ? 'Sending...' : 'Send reset link'}
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
    </Layout>
  );
}
