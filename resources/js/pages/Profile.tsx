import { useState } from 'react';
import FlashMessages from '../components/FlashMessages';
import { Head, Link, usePage } from '@inertiajs/react';
import { User } from '../types';
import { cn } from '../utils/cn';
import { theme } from '../theme';
import { Modal } from '../components/common/Modal';
import { useGetApiV1TotpStatus, usePostApiV1TotpDisable } from '../api/generated/totp/totp';

interface ProfileProps {
  title: string;
}

export default function Profile({ title }: ProfileProps) {
  const { props } = usePage();
  const user = props.currentUser as User;
  const [showDisableForm, setShowDisableForm] = useState(false);
  const [disableData, setDisableDataState] = useState({ password: '', code: '' });
  const [disableError, setDisableError] = useState('');

  const {
    data: totpStatusResponse,
    isLoading: totpLoading,
    refetch: refetchTotpStatus,
  } = useGetApiV1TotpStatus();
  const totpEnabled = totpStatusResponse?.data?.data?.enabled ?? null;

  const disableMutation = usePostApiV1TotpDisable();

  const setDisableData = (field: string, value: string) => {
    setDisableDataState((prev) => ({ ...prev, [field]: value }));
  };

  const disableTOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setDisableError('');

    try {
      await disableMutation.mutateAsync({
        data: disableData,
      });
      setShowDisableForm(false);
      setDisableDataState({ password: '', code: '' });
      refetchTotpStatus();
    } catch (error) {
      const message =
        (error as { message?: string })?.message || 'Failed to disable two-factor authentication';
      setDisableError(message);
    }
  };

  return (
    <>
      <Head title={title} />
      <div className="h-full overflow-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-8">
            <h1 className={cn('text-3xl font-bold mb-8', theme.text.strong)}>Profile</h1>

            <FlashMessages className="mb-6" />

            <div className="space-y-6">
              {/* User Information */}
              <div className={cn('shadow rounded-lg', theme.surface.panel)}>
                <div className="px-6 py-4 border-b border-slate-200/50 dark:border-slate-700/50">
                  <h2 className={cn('text-lg font-semibold', theme.text.strong)}>
                    User Information
                  </h2>
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
                        {totpLoading ? (
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
              footer={
                <div className="flex space-x-3 w-full">
                  <button
                    type="submit"
                    form="disable-2fa-form"
                    disabled={disableMutation.isPending}
                    className={cn('flex-1', theme.buttons.danger)}
                  >
                    {disableMutation.isPending ? 'Disabling...' : 'Disable 2FA'}
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
      </div>
    </>
  );
}
