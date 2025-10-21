import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import Layout from '../../components/layout/Layout';
import FlashMessages from '../../components/FlashMessages';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';

interface Props {
  title: string;
  qrCodeURI: string;
  secret: string;
  csrfToken?: string;
}

export default function TOTPSetup({ title, qrCodeURI, secret, csrfToken }: Props) {
  const [code, setCode] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    setError('');

    try {
      const response = await fetch('/api/v1/totp/enable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || '',
        },
        body: JSON.stringify({ code }),
        credentials: 'include',
      });

      const data = await response.json();

      if (response.ok) {
        router.visit('/profile', {
          onSuccess: () => {},
        });
      } else {
        setError(data.message || 'Failed to enable two-factor authentication');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Layout>
      <Head title={title} />

      <div className="max-w-2xl mx-auto p-6">
        <div className={cn('shadow-lg rounded-lg p-8', theme.surface.panel)}>
          <h1 className={cn('text-2xl font-bold mb-6', theme.text.strong)}>
            Setup Two-Factor Authentication
          </h1>

          <FlashMessages className="mb-6" />

          <div className="space-y-6">
            <div>
              <h2 className={cn('text-lg font-semibold mb-3', theme.text.strong)}>
                Step 1: Scan QR Code
              </h2>
              <p className={cn('mb-4', theme.text.muted)}>
                Use your authenticator app (Google Authenticator, Authy, etc.) to scan this QR code:
              </p>

              <div className={cn('p-4 rounded-lg text-center', theme.surface.muted)}>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCodeURI)}`}
                  alt="TOTP QR Code"
                  className="mx-auto"
                />
              </div>
            </div>

            <div>
              <h2 className={cn('text-lg font-semibold mb-3', theme.text.strong)}>
                Step 2: Manual Entry
              </h2>
              <p className={cn('mb-2', theme.text.muted)}>
                Or enter this secret manually in your authenticator app:
              </p>

              <div className={cn('p-3 rounded', theme.surface.code)}>
                <code className={cn('text-sm break-all', theme.text.strong)}>{secret}</code>
              </div>
            </div>

            <form onSubmit={submit}>
              <h2 className={cn('text-lg font-semibold mb-3', theme.text.strong)}>
                Step 3: Verify Setup
              </h2>
              <p className={cn('mb-4', theme.text.muted)}>
                Enter the 6-digit code from your authenticator app:
              </p>

              <div className="mb-4">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className={theme.forms.input}
                  placeholder="123456"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  required
                />
                {error && <div className={cn('mt-2 text-sm', theme.text.danger)}>{error}</div>}
              </div>

              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={processing}
                  className={cn('flex-1', theme.buttons.primary)}
                >
                  {processing ? 'Verifying...' : 'Enable Two-Factor Auth'}
                </button>

                <Link
                  href="/profile"
                  className={cn('flex-1 py-2 px-4 rounded-lg text-center', theme.buttons.secondary)}
                >
                  Cancel
                </Link>
              </div>
            </form>

            <div className={cn('p-4 rounded-lg', theme.intent.info.surface)}>
              <p className={cn('text-sm', theme.intent.info.textStrong)}>
                <strong>Note:</strong> Keep your authenticator app secure. You'll need it to log in
                once TOTP is enabled.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
