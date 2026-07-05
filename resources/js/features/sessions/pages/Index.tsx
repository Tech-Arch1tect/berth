import { formatDistanceToNow } from 'date-fns';
import {
  DevicePhoneMobileIcon,
  DeviceTabletIcon,
  ComputerDesktopIcon,
  CpuChipIcon,
  GlobeAltIcon,
  FireIcon,
  CommandLineIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { cn } from '../../../shared/utils/cn';
import { theme } from '../../../shared/theme';
import { EmptyState } from '../../../shared/components/EmptyState';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner';
import { ConfirmationModal } from '../../../shared/components/ConfirmationModal';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetApiV1Sessions,
  usePostApiV1SessionsRevoke,
  usePostApiV1SessionsRevokeAllOthers,
  getGetApiV1SessionsQueryKey,
} from '../../../api/generated/sessions/sessions';
import type { SessionItem } from '../../../api/generated/models';

export default function SessionsIndex() {
  useDocumentTitle('Active Sessions');
  const queryClient = useQueryClient();
  const [showRevokeAllModal, setShowRevokeAllModal] = useState(false);
  const [sessionToRevoke, setSessionToRevoke] = useState<{ id: number; label: string } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  const { data: sessionsResponse, isLoading: sessionsLoading } = useGetApiV1Sessions();
  const sessions = sessionsResponse?.data?.sessions ?? [];

  const invalidateSessions = () =>
    queryClient.invalidateQueries({ queryKey: getGetApiV1SessionsQueryKey() });

  const revokeMutation = usePostApiV1SessionsRevoke();
  const revokeAllMutation = usePostApiV1SessionsRevokeAllOthers();

  const handleRevokeSessionClick = (session: SessionItem) => {
    setSessionToRevoke({
      id: session.id,
      label: `${session.browser} on ${session.os} (${session.ip_address})`,
    });
    setError(null);
  };

  const confirmRevokeSession = async () => {
    if (!sessionToRevoke) return;

    setError(null);

    try {
      await revokeMutation.mutateAsync({
        data: { session_id: sessionToRevoke.id },
      });
      invalidateSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke session');
    } finally {
      setSessionToRevoke(null);
    }
  };

  const confirmRevokeAllOthers = async () => {
    setError(null);

    try {
      await revokeAllMutation.mutateAsync({
        data: {},
      });
      invalidateSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke sessions');
    } finally {
      setShowRevokeAllModal(false);
    }
  };

  const formatDate = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  };

  const getDeviceIcon = (session: SessionItem) => {
    const iconClass = cn('h-8 w-8', theme.text.muted);

    if (session.bot) return <CpuChipIcon className={iconClass} />;
    if (session.mobile) return <DevicePhoneMobileIcon className={iconClass} />;
    if (session.tablet) return <DeviceTabletIcon className={iconClass} />;

    const browser = session.browser.toLowerCase();
    if (browser.includes('chrome')) return <GlobeAltIcon className={iconClass} />;
    if (browser.includes('firefox')) return <FireIcon className={iconClass} />;
    if (browser.includes('safari')) return <CommandLineIcon className={iconClass} />;
    if (browser.includes('edge')) return <ShieldCheckIcon className={iconClass} />;
    if (browser.includes('opera')) return <ExclamationTriangleIcon className={iconClass} />;

    return <ComputerDesktopIcon className={iconClass} />;
  };

  const getDeviceTypeColor = (session: SessionItem) => {
    if (session.bot) return cn(theme.badges.tag.base, theme.badges.tag.info);
    if (session.mobile) return cn(theme.badges.tag.base, theme.badges.tag.info);
    if (session.tablet) return cn(theme.badges.tag.base, theme.badges.tag.success);
    return cn(theme.badges.tag.base, theme.badges.tag.neutral);
  };

  if (sessionsLoading) {
    return <LoadingSpinner size="lg" text="Loading sessions..." fullScreen />;
  }

  return (
    <>
      <div className="h-full overflow-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-8">
            <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
              <h1 className={cn('text-3xl font-bold', theme.text.strong)}>Active Sessions</h1>
              {sessions.filter((s) => !s.current).length > 0 && (
                <button
                  onClick={() => setShowRevokeAllModal(true)}
                  disabled={revokeAllMutation.isPending || revokeMutation.isPending}
                  className={cn(
                    theme.buttons.danger,
                    (revokeAllMutation.isPending || revokeMutation.isPending) && 'opacity-50'
                  )}
                >
                  {revokeAllMutation.isPending ? 'Revoking...' : 'Revoke All Others'}
                </button>
              )}
            </div>

            {error && (
              <div className={cn(theme.intent.danger.surface, 'mb-6 rounded-lg p-4')}>
                <div className="flex">
                  <div className="flex-shrink-0">
                    <ExclamationTriangleIcon className={cn('h-5 w-5', theme.intent.danger.icon)} />
                  </div>
                  <div className="ml-3">
                    <p className={cn('text-sm', theme.intent.danger.textStrong)}>{error}</p>
                  </div>
                </div>
              </div>
            )}

            <div className={cn(theme.surface.panel, 'shadow overflow-hidden sm:rounded-md')}>
              <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                {sessions.map((session) => (
                  <li key={session.id} className="px-4 py-4 sm:px-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-start gap-4">
                        <div className="flex-shrink-0">{getDeviceIcon(session)}</div>
                        <div className="min-w-0 flex-1">
                          <div className="mb-1.5 flex flex-wrap items-center gap-2">
                            <p className={cn('text-sm font-medium', theme.text.strong)}>
                              {session.browser}
                            </p>
                            <span className={getDeviceTypeColor(session)}>
                              {session.device_type}
                            </span>
                            <span className={cn(theme.badges.tag.base, theme.badges.tag.neutral)}>
                              {session.type.toUpperCase()}
                            </span>
                            {session.current && (
                              <span className={cn(theme.badges.tag.base, theme.badges.tag.success)}>
                                Current Session
                              </span>
                            )}
                          </div>
                          <p className={cn('text-sm', theme.text.muted)}>
                            {session.os} · {session.device} ·{' '}
                            <span className="font-mono">{session.ip_address}</span>
                            {!/unknown/i.test(session.location) && <> · {session.location}</>}
                          </p>
                          <p className={cn('mt-0.5 text-xs', theme.text.subtle)}>
                            Active {formatDate(session.last_used)} · Signed in{' '}
                            {formatDate(session.created_at)} · Expires{' '}
                            {formatDate(session.expires_at)}
                          </p>
                        </div>
                      </div>

                      {!session.current && (
                        <div className="flex-shrink-0 self-end sm:self-auto">
                          <button
                            onClick={() => handleRevokeSessionClick(session)}
                            disabled={revokeMutation.isPending || revokeAllMutation.isPending}
                            className={cn(
                              'inline-flex min-h-[44px] items-center text-sm leading-4',
                              theme.buttons.danger,
                              (revokeMutation.isPending || revokeAllMutation.isPending) &&
                                'opacity-50'
                            )}
                          >
                            {revokeMutation.isPending && sessionToRevoke?.id === session.id
                              ? 'Revoking...'
                              : 'Revoke'}
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {sessions.length === 0 && (
              <EmptyState
                icon={InformationCircleIcon}
                title="No active sessions found"
                description="This might indicate a configuration issue with session tracking."
                variant="info"
              />
            )}

            <div className={cn(theme.intent.info.surface, 'mt-8 rounded-lg p-4')}>
              <div className="flex">
                <div className="flex-shrink-0">
                  <InformationCircleIcon className={cn('h-5 w-5', theme.intent.info.icon)} />
                </div>
                <div className="ml-3">
                  <p className={cn('text-sm', theme.intent.info.textStrong)}>
                    <strong>Security Note:</strong> If you see any sessions you don't recognise,
                    revoke them immediately. You can also revoke all other sessions if you suspect
                    unauthorised access.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Revoke Session Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!sessionToRevoke}
        onClose={() => setSessionToRevoke(null)}
        onConfirm={confirmRevokeSession}
        title="Revoke Session"
        message={`Are you sure you want to revoke the session for ${sessionToRevoke?.label}? You will be logged out from that device.`}
        variant="danger"
      />

      {/* Revoke All Others Confirmation Modal */}
      <ConfirmationModal
        isOpen={showRevokeAllModal}
        onClose={() => setShowRevokeAllModal(false)}
        onConfirm={confirmRevokeAllOthers}
        title="Revoke All Other Sessions"
        message="Are you sure you want to revoke all other sessions? You will be logged out from all other devices."
        variant="danger"
      />
    </>
  );
}
