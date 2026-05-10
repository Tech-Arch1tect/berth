import { Link, useNavigate } from '@tanstack/react-router';
import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { cn } from '../../../shared/utils/cn';
import { theme } from '../../../shared/theme';
import { useGetApiV1TotpSetup, usePostApiV1TotpEnable } from '../../../api/generated/totp/totp';

export default function TOTPSetup() {
  useDocumentTitle('Setup Two-Factor Authentication');
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const { data: setupResponse, isLoading: setupLoading } = useGetApiV1TotpSetup();
  const qrCodeURI = setupResponse?.data?.qr_code_uri ?? '';
  const secret = setupResponse?.data?.secret ?? '';

  const enableMutation = usePostApiV1TotpEnable();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await enableMutation.mutateAsync({
        data: { code },
      });
      navigate({ to: '/profile' });
    } catch (err) {
      const message =
        (err as { message?: string })?.message || 'Failed to enable two-factor authentication';
      setError(message);
    }
  };

  if (setupLoading || !qrCodeURI) {
    return <LoadingSpinner size="lg" text="Preparing setup..." fullScreen />;
  }

  return (
    <>
      <div className="max-w-2xl mx-auto p-6">
        <div className={cn('shadow-lg rounded-lg p-8', theme.surface.panel)}>
          <h1 className={cn('text-2xl font-bold mb-6', theme.text.strong)}>
            Setup Two-Factor Authentication
          </h1>

          <div className="space-y-6">
            <div>
              <h2 className={cn('text-lg font-semibold mb-3', theme.text.strong)}>
                Step 1: Scan QR Code
              </h2>
              <p className={cn('mb-4', theme.text.muted)}>
                Use your authenticator app (Google Authenticator, Authy, etc.) to scan this QR code:
              </p>

              <div className={cn('p-4 rounded-lg text-center', theme.surface.muted)}>
                <QRCodeSVG value={qrCodeURI} size={200} className="mx-auto" />
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
                  disabled={enableMutation.isPending}
                  className={cn('flex-1', theme.buttons.primary)}
                >
                  {enableMutation.isPending ? 'Verifying...' : 'Enable Two-Factor Auth'}
                </button>

                <Link
                  to="/profile"
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
    </>
  );
}
