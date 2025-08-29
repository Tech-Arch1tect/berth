import React, { useState, useEffect } from 'react';
import { useOperations } from '../../hooks/useOperations';
import { OperationPresets } from './OperationPresets';
import { OperationBuilder } from './OperationBuilder';
import { OperationLogs } from './OperationLogs';
import { OperationRequest } from '../../types/operations';

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

  const { operationStatus, isConnecting, error, startOperation, clearLogs, connect, isConnected } =
    useOperations({
      serverid,
      stackname,
      onOperationComplete: (success, exitCode) => {
        setActiveTab('logs');
        onOperationComplete?.(success, exitCode);
      },
      onError: (error) => {
        console.error('Operation error:', error);
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
      alert(`Failed to start operation: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleClose = () => {
    if (operationStatus.isRunning) {
      if (!confirm('An operation is currently running. Are you sure you want to close?')) {
        return;
      }
    }
    onClose();
  };

  const handleConnect = () => {
    connect();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-6xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Stack Operations
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {stackname} on Server {serverid}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Connection Status */}
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  isConnected
                    ? 'bg-green-500'
                    : isConnecting
                      ? 'bg-yellow-500 animate-pulse'
                      : 'bg-red-500'
                }`}
              ></div>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {isConnected ? 'Connected' : isConnecting ? 'Connecting...' : 'Disconnected'}
              </span>
              {!isConnected && !isConnecting && (
                <button
                  onClick={handleConnect}
                  className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Reconnect
                </button>
              )}
            </div>

            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              disabled={operationStatus.isRunning}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-3 dark:bg-red-900/20 dark:border-red-600">
            <div className="text-sm text-red-700 dark:text-red-400">
              <strong>Connection Error:</strong> {error}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('presets')}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              activeTab === 'presets'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Quick Actions
          </button>
          <button
            onClick={() => setActiveTab('builder')}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              activeTab === 'builder'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Custom Operation
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2 text-sm font-medium border-b-2 relative ${
              activeTab === 'logs'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Logs
            {operationStatus.logs.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {operationStatus.logs.length > 99 ? '99+' : operationStatus.logs.length}
              </span>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'presets' && (
            <div className="p-6 h-full overflow-auto">
              <OperationPresets
                onOperationSelect={handleOperationStart}
                disabled={operationStatus.isRunning || !isConnected}
              />
            </div>
          )}

          {activeTab === 'builder' && (
            <div className="p-6 h-full overflow-auto">
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

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {operationStatus.isRunning && (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Running: {operationStatus.command}
                  </span>
                  {operationStatus.startTime && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Started {operationStatus.startTime.toLocaleTimeString()}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {operationStatus.logs.length > 0 && (
                <button
                  onClick={clearLogs}
                  disabled={operationStatus.isRunning}
                  className="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300 disabled:opacity-50"
                >
                  Clear Logs
                </button>
              )}

              <button
                onClick={handleClose}
                disabled={operationStatus.isRunning}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  operationStatus.isRunning
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-600 dark:text-gray-400'
                    : 'bg-gray-600 text-white hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600'
                }`}
              >
                {operationStatus.isRunning ? 'Operation Running...' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
