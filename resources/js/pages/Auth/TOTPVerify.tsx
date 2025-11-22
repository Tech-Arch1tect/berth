import { Head, useForm } from '@inertiajs/react';
import FlashMessages from '../../components/FlashMessages';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';

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
    <>
      <Head title={title} />

      <div className="space-y-6">
        <div className="text-center">
          <h2 className={cn('text-2xl font-bold', theme.text.strong)}>Two-Factor Authentication</h2>
          <p className={cn('mt-2 text-sm', theme.text.muted)}>
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
              className={cn('text-center text-2xl tracking-widest', theme.forms.input)}
              placeholder="123456"
              maxLength={6}
              pattern="[0-9]{6}"
              autoComplete="one-time-code"
              required
            />
            {errors.code && (
              <div className={cn('mt-2 text-sm', theme.text.danger)}>{errors.code}</div>
            )}
          </div>

          <div>
            <button
              type="submit"
              disabled={processing}
              className={cn('w-full flex justify-center', theme.buttons.primary)}
            >
              {processing ? 'Verifying...' : 'Verify Code'}
            </button>
          </div>

          <div className="text-center">
            <p className={cn('text-sm', theme.text.muted)}>
              Having trouble? Contact support for assistance.
            </p>
          </div>
        </form>
      </div>
    </>
  );
}
