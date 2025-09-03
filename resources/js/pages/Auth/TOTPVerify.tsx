import { Head, useForm } from '@inertiajs/react';
import Layout from '../../components/Layout';
import FlashMessages from '../../components/FlashMessages';

interface Props {
  title: string;
  csrfToken?: string;
}

interface FormData {
  code: string;
}

export default function TOTPVerify({ title, csrfToken }: Props) {
  const { data, setData, post, processing, errors } = useForm<FormData>({
    code: '',
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    post('/auth/totp/verify', {
      headers: {
        'X-CSRF-Token': csrfToken || '',
      },
    });
  };

  return (
    <Layout>
      <Head title={title} />

      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Two-Factor Authentication
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Enter the 6-digit code from your authenticator app
          </p>
        </div>

        <FlashMessages />

        <form className="space-y-6" onSubmit={submit}>
          <div>
            <label htmlFor="code" className="sr-only">
              Authentication Code
            </label>
            <input
              id="code"
              name="code"
              type="text"
              value={data.code}
              onChange={(e) => setData('code', e.target.value)}
              className="appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-700 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm text-center text-2xl tracking-widest"
              placeholder="123456"
              maxLength={6}
              pattern="[0-9]{6}"
              autoComplete="one-time-code"
              required
            />
            {errors.code && (
              <div className="mt-2 text-red-600 dark:text-red-400 text-sm">{errors.code}</div>
            )}
          </div>

          <div>
            <button
              type="submit"
              disabled={processing}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 dark:bg-indigo-700 hover:bg-indigo-700 dark:hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-indigo-500 disabled:opacity-50"
            >
              {processing ? 'Verifying...' : 'Verify Code'}
            </button>
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Having trouble? Contact support for assistance.
            </p>
          </div>
        </form>
      </div>
    </Layout>
  );
}
