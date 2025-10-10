import Layout from '../../components/layout/Layout';
import FlashMessages from '../../components/FlashMessages';
import { Head, useForm, usePage, router } from '@inertiajs/react';
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
import { cn } from '../../utils/cn';
import { theme } from '../../theme';
import { EmptyState } from '../../components/common/EmptyState';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';
import { useState } from 'react';

interface Session {
  id: number;
  current: boolean;
  type: string;
  ip_address: string;
  location: string;
  browser: string;
  os: string;
  device_type: string;
  device: string;
  mobile: boolean;
  tablet: boolean;
  desktop: boolean;
  bot: boolean;
  created_at: string;
  last_used: string;
  expires_at: string;
}

interface SessionsProps {
  sessions: Session[];
}

export default function SessionsIndex({ sessions }: SessionsProps) {
  const { processing } = useForm();
  const { props } = usePage();
  const csrfToken = props.csrfToken as string | undefined;

  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [showRevokeAllModal, setShowRevokeAllModal] = useState(false);
  const [sessionToRevoke, setSessionToRevoke] = useState<number | null>(null);

  const handleRevokeSessionClick = (sessionId: number) => {
    setSessionToRevoke(sessionId);
    setShowRevokeModal(true);
  };

  const confirmRevokeSession = () => {
    if (sessionToRevoke) {
      router.post(
        '/sessions/revoke',
        {
          session_id: sessionToRevoke,
        },
        {
          headers: {
            'X-CSRF-Token': csrfToken || '',
          },
          preserveState: true,
        }
      );
    }
    setShowRevokeModal(false);
    setSessionToRevoke(null);
  };

  const confirmRevokeAllOthers = () => {
    router.post(
      '/sessions/revoke-all-others',
      {},
      {
        headers: {
          'X-CSRF-Token': csrfToken || '',
        },
        preserveState: true,
      }
    );
    setShowRevokeAllModal(false);
  };

  const formatDate = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  };

  const getDeviceIcon = (session: Session) => {
    const iconClass = cn('h-8 w-8', theme.text.muted);

    // Return icon based on device type and browser
    if (session.bot) return <CpuChipIcon className={iconClass} />;
    if (session.mobile) return <DevicePhoneMobileIcon className={iconClass} />;
    if (session.tablet) return <DeviceTabletIcon className={iconClass} />;

    // Desktop browser icons
    const browser = session.browser.toLowerCase();
    if (browser.includes('chrome')) return <GlobeAltIcon className={iconClass} />;
    if (browser.includes('firefox')) return <FireIcon className={iconClass} />;
    if (browser.includes('safari')) return <CommandLineIcon className={iconClass} />;
    if (browser.includes('edge')) return <ShieldCheckIcon className={iconClass} />;
    if (browser.includes('opera')) return <ExclamationTriangleIcon className={iconClass} />;

    return <ComputerDesktopIcon className={iconClass} />;
  };

  const getDeviceTypeColor = (session: Session) => {
    if (session.bot) return cn(theme.badges.tag.base, theme.badges.tag.info);
    if (session.mobile) return cn(theme.badges.tag.base, theme.badges.tag.info);
    if (session.tablet) return cn(theme.badges.tag.base, theme.badges.tag.success);
    return cn(theme.badges.tag.base, theme.badges.tag.neutral);
  };

  return (
    <Layout>
      <Head title="Active Sessions" />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-8">
          <div className="flex justify-between items-center mb-8">
            <h1 className={cn('text-3xl font-bold', theme.text.strong)}>Active Sessions</h1>
            {sessions.filter((s) => !s.current).length > 0 && (
              <button
                onClick={() => setShowRevokeAllModal(true)}
                disabled={processing}
                className={cn(theme.buttons.danger, processing && 'opacity-50')}
              >
                Revoke All Others
              </button>
            )}
          </div>

          <FlashMessages className="mb-6" />

          <div className={cn(theme.surface.panel, 'shadow overflow-hidden sm:rounded-md')}>
            <ul className="divide-y divide-slate-200 dark:divide-slate-800">
              {sessions.map((session) => (
                <li key={session.id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">{getDeviceIcon(session)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-2">
                          <p className={cn('text-sm font-medium', theme.text.strong)}>
                            {session.browser}
                          </p>
                          <span className={getDeviceTypeColor(session)}>{session.device_type}</span>
                          <span className={cn(theme.badges.tag.base, theme.badges.tag.neutral)}>
                            {session.type.toUpperCase()}
                          </span>
                          {session.current && (
                            <span className={cn(theme.badges.tag.base, theme.badges.tag.success)}>
                              Current Session
                            </span>
                          )}
                        </div>
                        <div className={cn('mt-1 text-sm space-y-1', theme.text.muted)}>
                          <p>
                            <span className="font-medium">Operating System:</span> {session.os}
                          </p>
                          <p>
                            <span className="font-medium">Device:</span> {session.device}
                          </p>
                          <p>
                            <span className="font-medium">Location:</span> {session.location}
                          </p>
                          <p>
                            <span className="font-medium">IP Address:</span> {session.ip_address}
                          </p>
                          <p>
                            <span className="font-medium">Last Active:</span>{' '}
                            {formatDate(session.last_used)}
                          </p>
                          <p>
                            <span className="font-medium">Created:</span>{' '}
                            {formatDate(session.created_at)}
                          </p>
                          <p>
                            <span className="font-medium">Expires:</span>{' '}
                            {formatDate(session.expires_at)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {!session.current && (
                      <div className="flex-shrink-0">
                        <button
                          onClick={() => handleRevokeSessionClick(session.id)}
                          disabled={processing}
                          className={cn(
                            'inline-flex items-center text-sm leading-4',
                            theme.buttons.danger,
                            processing && 'opacity-50'
                          )}
                        >
                          Revoke
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

      {/* Revoke Session Confirmation Modal */}
      <ConfirmationModal
        isOpen={showRevokeModal}
        onClose={() => {
          setShowRevokeModal(false);
          setSessionToRevoke(null);
        }}
        onConfirm={confirmRevokeSession}
        title="Revoke Session"
        message="Are you sure you want to revoke this session? You will be logged out from that device."
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
    </Layout>
  );
}
