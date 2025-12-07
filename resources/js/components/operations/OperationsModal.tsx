import React, { useEffect, useState } from 'react';
import { useOperations } from '../../hooks/useOperations';
import { OperationRequest } from '../../types/operations';
import { Modal } from '../common/Modal';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { theme } from '../../theme';
import { cn } from '../../utils/cn';
import { OperationBuilder } from './OperationBuilder';
import { OperationLogs } from './OperationLogs';
import { OperationPresets } from './OperationPresets';

interface OperationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  serverid: string;
  stackname: string;
  services?: Array<{ name: string; service_name?: string }>;
  onOperationComplete?: (success: boolean, exitCode?: number) => void;
}

type TabType = 'presets' | 'builder' | 'logs';

export const OperationsModal: React.FC<OperationsModalProps> = ({
  isOpen,
  onClose,
  serverid,
  stackname,
  services,
  onOperationComplete,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('presets');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showCloseConfirmation, setShowCloseConfirmation] = useState(false);

  const { operationStatus, isConnecting, error, startOperation, clearLogs, connect, isConnected } =
    useOperations({
      serverid,
      stackname,
      onOperationComplete: (success, exitCode) => {
        setActiveTab('logs');
        onOperationComplete?.(success, exitCode);
      },
      onError: (err) => {
        console.error('Operation error:', err);
      },
    });

  useEffect(() => {
    if (isOpen && !isConnected && !isConnecting) {
      connect();
    }
  }, [isOpen, isConnected, isConnecting, connect]);

  const handleOperationStart = async (operation: OperationRequest) => {
    try {
      await startOperation(operation);
      setActiveTab('logs');
    } catch (err) {
      console.error('Failed to start operation:', err);
      setErrorMessage(
        `Failed to start operation: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  };

  const handleClose = () => {
    if (operationStatus.isRunning) {
      setShowCloseConfirmation(true);
      return;
    }
    onClose();
  };

  const confirmClose = () => {
    setShowCloseConfirmation(false);
    onClose();
  };

  const connectionStatus = isConnected ? 'connected' : isConnecting ? 'connecting' : 'disconnected';

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Stack Operations"
      subtitle={`${stackname} on Server ${serverid}`}
      size="xl"
      headerExtra={
        <div className="flex items-center gap-2 text-xs">
          <span
            className={cn(
              theme.badges.dot.base,
              connectionStatus === 'connected'
                ? theme.badges.dot.success
                : connectionStatus === 'connecting'
                  ? theme.badges.dot.warning
                  : theme.badges.dot.danger,
              connectionStatus === 'connecting' && 'animate-pulse'
            )}
          />
          <span className={theme.text.subtle}>
            {connectionStatus === 'connected'
              ? 'Connected'
              : connectionStatus === 'connecting'
                ? 'Connecting…'
                : 'Disconnected'}
          </span>
          {!isConnected && !isConnecting && (
            <button type="button" onClick={connect} className={cn(theme.buttons.subtle, 'text-xs')}>
              Reconnect
            </button>
          )}
        </div>
      }
      footer={
        <div className="flex items-center justify-between gap-4 w-full">
          <div className="flex items-center gap-3 text-sm">
            {operationStatus.isRunning && (
              <div className="flex items-center gap-2">
                <span className={theme.effects.spinner} />
                <span className={theme.text.subtle}>Running: {operationStatus.command}</span>
                {operationStatus.startTime && (
                  <span className={cn('text-xs', theme.text.subtle)}>
                    Started {operationStatus.startTime.toLocaleTimeString()}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {operationStatus.logs.length > 0 && (
              <button
                type="button"
                onClick={clearLogs}
                disabled={operationStatus.isRunning}
                className={cn(
                  theme.buttons.subtle,
                  'text-sm',
                  operationStatus.isRunning && 'opacity-60'
                )}
              >
                Clear Logs
              </button>
            )}

            <button
              type="button"
              onClick={handleClose}
              disabled={operationStatus.isRunning}
              className={cn(
                theme.buttons.secondary,
                operationStatus.isRunning ? 'opacity-60 cursor-not-allowed' : ''
              )}
            >
              {operationStatus.isRunning ? 'Operation Running…' : 'Close'}
            </button>
          </div>
        </div>
      }
    >
      {error && (
        <div className={cn(theme.alerts.base, theme.alerts.variants.error, 'mb-4')}>
          <strong>Connection Error:</strong> {error}
        </div>
      )}

      <nav className={cn(theme.tabs.container, 'mb-4')}>
        <button
          type="button"
          onClick={() => setActiveTab('presets')}
          className={cn(
            theme.tabs.trigger,
            activeTab === 'presets' ? theme.tabs.active : theme.tabs.inactive
          )}
        >
          Quick Actions
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('builder')}
          className={cn(
            theme.tabs.trigger,
            activeTab === 'builder' ? theme.tabs.active : theme.tabs.inactive
          )}
        >
          Custom Operation
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('logs')}
          className={cn(
            theme.tabs.trigger,
            'relative',
            activeTab === 'logs' ? theme.tabs.active : theme.tabs.inactive
          )}
        >
          Logs
          {operationStatus.logs.length > 0 && (
            <span className={theme.tabs.badge}>
              {operationStatus.logs.length > 99 ? '99+' : operationStatus.logs.length}
            </span>
          )}
        </button>
      </nav>

      <div className="overflow-hidden" style={{ height: '400px' }}>
        {activeTab === 'presets' && (
          <div className="h-full overflow-auto">
            <OperationPresets
              onOperationSelect={handleOperationStart}
              disabled={operationStatus.isRunning || !isConnected}
            />
          </div>
        )}

        {activeTab === 'builder' && (
          <div className="h-full overflow-auto">
            <OperationBuilder
              onOperationBuild={handleOperationStart}
              disabled={operationStatus.isRunning || !isConnected}
              services={services}
            />
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="h-full">
            <OperationLogs logs={operationStatus.logs} isRunning={operationStatus.isRunning} />
          </div>
        )}
      </div>

      {/* Error Modal */}
      <Modal
        isOpen={!!errorMessage}
        onClose={() => setErrorMessage(null)}
        title="Operation Error"
        size="sm"
        footer={
          <div className="flex justify-end">
            <button onClick={() => setErrorMessage(null)} className={theme.buttons.primary}>
              OK
            </button>
          </div>
        }
      >
        <p className={cn(theme.text.standard)}>{errorMessage}</p>
      </Modal>

      {/* Close Confirmation Modal */}
      <ConfirmationModal
        isOpen={showCloseConfirmation}
        onClose={() => setShowCloseConfirmation(false)}
        onConfirm={confirmClose}
        title="Operation Running"
        message="An operation is currently running. Are you sure you want to close?"
        confirmText="Close Anyway"
        variant="warning"
      />
    </Modal>
  );
};
