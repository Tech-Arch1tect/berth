import { useState, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import FlashMessages from '../components/FlashMessages';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { User } from '../types';
import { cn } from '../utils/cn';
import { theme } from '../theme';
import { Modal } from '../components/common/Modal';

interface ProfileProps {
  title: string;
  csrfToken?: string;
}

export default function Profile({ title, csrfToken }: ProfileProps) {
  const { props } = usePage();
  const user = props.currentUser as User;
  const [totpEnabled, setTotpEnabled] = useState<boolean | null>(null);
  const [showDisableForm, setShowDisableForm] = useState(false);
  const [disableData, setDisableDataState] = useState({ password: '', code: '' });
  const [disableProcessing, setDisableProcessing] = useState(false);
  const [disableError, setDisableError] = useState('');

  const setDisableData = (field: string, value: string) => {
    setDisableDataState((prev) => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    // Fetch TOTP status
    fetch('/api/v1/totp/status', { credentials: 'include' })
      .then((response) => response.json())
      .then((data) => setTotpEnabled(data.enabled))
      .catch((error) => console.error('Failed to fetch TOTP status:', error));
  }, []);

  const disableTOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setDisableProcessing(true);
    setDisableError('');

    try {
      const response = await fetch('/api/v1/totp/disable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || '',
        },
        body: JSON.stringify(disableData),
        credentials: 'include',
      });

      const data = await response.json();

      if (response.ok) {
        setShowDisableForm(false);
        setDisableDataState({ password: '', code: '' });
        setTotpEnabled(false);
      } else {
        setDisableError(data.message || 'Failed to disable two-factor authentication');
      }
    } catch (err) {
      setDisableError('Network error. Please try again.');
    } finally {
      setDisableProcessing(false);
    }
  };

  return (
    <Layout>
      <Head title={title} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-8">
          <h1 className={cn('text-3xl font-bold mb-8', theme.text.strong)}>Profile</h1>

          <FlashMessages className="mb-6" />

          <div className="space-y-6">
            {/* User Information */}
            <div className={cn('shadow rounded-lg', theme.surface.panel)}>
              <div className="px-6 py-4 border-b border-slate-200/50 dark:border-slate-700/50">
                <h2 className={cn('text-lg font-semibold', theme.text.strong)}>User Information</h2>
              </div>
              <div className="px-6 py-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={cn('block text-sm font-medium', theme.text.standard)}>
                      Username
                    </label>
                    <div className={cn('mt-1 p-2 rounded-md', theme.surface.muted)}>
                      <span className={theme.text.strong}>{user.username}</span>
                    </div>
                  </div>

                  <div>
                    <label className={cn('block text-sm font-medium', theme.text.standard)}>
                      Email
                    </label>
                    <div className={cn('mt-1 p-2 rounded-md', theme.surface.muted)}>
                      <span className={theme.text.strong}>{user.email}</span>
                    </div>
                  </div>

                  <div>
                    <label className={cn('block text-sm font-medium', theme.text.standard)}>
                      Member since
                    </label>
                    <div className={cn('mt-1 p-2 rounded-md', theme.surface.muted)}>
                      <span className={theme.text.strong}>
                        {new Date(user.created_at).toLocaleDateString('en-GB', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className={cn('block text-sm font-medium', theme.text.standard)}>
                      Last updated
                    </label>
                    <div className={cn('mt-1 p-2 rounded-md', theme.surface.muted)}>
                      <span className={theme.text.strong}>
                        {new Date(user.updated_at).toLocaleDateString('en-GB', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Security Settings */}
            <div className={cn('shadow rounded-lg', theme.surface.panel)}>
              <div className="px-6 py-4 border-b border-slate-200/50 dark:border-slate-700/50">
                <h2 className={cn('text-lg font-semibold', theme.text.strong)}>
                  Security Settings
                </h2>
              </div>
              <div className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className={cn('text-base font-medium', theme.text.strong)}>
                      Two-Factor Authentication
                    </h3>
                    <p className={cn('text-sm mt-1', theme.text.muted)}>
                      Add an extra layer of security to your account with TOTP authentication.
                    </p>
                    <div className="mt-2">
                      {totpEnabled === null ? (
                        <span className={cn(theme.badges.tag.base, theme.badges.tag.neutral)}>
                          Loading...
                        </span>
                      ) : totpEnabled ? (
                        <span className={cn(theme.badges.tag.base, theme.badges.tag.success)}>
                          ✓ Enabled
                        </span>
                      ) : (
                        <span className={cn(theme.badges.tag.base, theme.badges.tag.danger)}>
                          ✗ Disabled
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex space-x-3">
                    {totpEnabled ? (
                      <button
                        onClick={() => setShowDisableForm(true)}
                        className={cn(
                          'px-4 py-2 rounded-md text-sm font-medium',
                          theme.buttons.danger
                        )}
                      >
                        Disable 2FA
                      </button>
                    ) : (
                      <Link
                        href="/auth/totp/setup"
                        className={cn(
                          'px-4 py-2 rounded-md text-sm font-medium',
                          theme.buttons.primary
                        )}
                      >
                        Enable 2FA
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* TOTP Disable Modal */}
          <Modal
            isOpen={showDisableForm}
            onClose={() => {
              setShowDisableForm(false);
              setDisableDataState({ password: '', code: '' });
              setDisableError('');
            }}
            title="Disable Two-Factor Authentication"
            size="sm"
            variant="warning"
            footer={
              <div className="flex space-x-3 w-full">
                <button
                  type="submit"
                  form="disable-2fa-form"
                  disabled={disableProcessing}
                  className={cn('flex-1', theme.buttons.danger)}
                >
                  {disableProcessing ? 'Disabling...' : 'Disable 2FA'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDisableForm(false);
                    setDisableDataState({ password: '', code: '' });
                    setDisableError('');
                  }}
                  className={cn('flex-1', theme.buttons.secondary)}
                >
                  Cancel
                </button>
              </div>
            }
          >
            <form id="disable-2fa-form" onSubmit={disableTOTP}>
              <div className="mb-4">
                <label className={cn('block text-sm font-medium mb-2', theme.forms.label)}>
                  Current Password
                </label>
                <input
                  type="password"
                  value={disableData.password}
                  onChange={(e) => setDisableData('password', e.target.value)}
                  className={theme.forms.input}
                  required
                />
              </div>

              <div className="mb-4">
                <label className={cn('block text-sm font-medium mb-2', theme.forms.label)}>
                  TOTP Code
                </label>
                <input
                  type="text"
                  value={disableData.code}
                  onChange={(e) => setDisableData('code', e.target.value)}
                  className={theme.forms.input}
                  placeholder="123456"
                  maxLength={6}
                  required
                />
                {disableError && (
                  <div className={cn('mt-2 text-sm', theme.text.danger)}>{disableError}</div>
                )}
              </div>

              <div className={cn('p-3 rounded-md mb-4', theme.intent.warning.surface)}>
                <p className={cn('text-sm', theme.intent.warning.textStrong)}>
                  <strong>Warning:</strong> Disabling 2FA will make your account less secure.
                </p>
              </div>
            </form>
          </Modal>
        </div>
      </div>
    </Layout>
  );
}
