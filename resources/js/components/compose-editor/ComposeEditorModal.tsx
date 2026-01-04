import React from 'react';
import { Modal } from '../common/Modal';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ComposeEditorProvider, useComposeEditor, EditorSection } from './ComposeEditorProvider';
import { useComposeEditorData } from './hooks/useComposeEditorData';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';

interface ComposeEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  serverId: number;
  stackName: string;
  composeFile: string;
}

const SECTION_TABS: { key: EditorSection; label: string }[] = [
  { key: 'services', label: 'Services' },
  { key: 'networks', label: 'Networks' },
  { key: 'volumes', label: 'Volumes' },
  { key: 'secrets', label: 'Secrets' },
  { key: 'configs', label: 'Configs' },
];

const ComposeEditorContent: React.FC<{
  serverId: number;
  stackName: string;
  composeFile: string;
  onClose: () => void;
}> = ({ serverId, stackName, composeFile, onClose }) => {
  const { state, selectSection, selectService } = useComposeEditor();
  useComposeEditorData({ serverId, stackName });

  const serviceNames = state.composeData ? Object.keys(state.composeData.services) : [];

  if (state.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="text-center py-12">
        <p className={theme.text.danger}>{state.error}</p>
      </div>
    );
  }

  if (!state.composeData) {
    return (
      <div className="text-center py-12">
        <p className={theme.text.muted}>No compose configuration found</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-[500px]">
      <div className="flex items-center mb-4 pb-4 border-b border-zinc-200 dark:border-zinc-700">
        <div className="flex space-x-1">
          {SECTION_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => selectSection(tab.key)}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                state.selectedSection === tab.key
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 gap-4">
        {state.selectedSection === 'services' && (
          <>
            <div className="w-48 shrink-0">
              <h4 className={cn('text-sm font-medium mb-2', theme.text.muted)}>Services</h4>
              <div className="space-y-1">
                {serviceNames.map((name) => (
                  <button
                    key={name}
                    onClick={() => selectService(name)}
                    className={cn(
                      'w-full text-left px-3 py-2 text-sm rounded-lg transition-colors',
                      state.selectedService === name
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
                    )}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 border-l border-zinc-200 dark:border-zinc-700 pl-4">
              {state.selectedService ? (
                <ServiceEditor serviceName={state.selectedService} />
              ) : (
                <p className={theme.text.muted}>Select a service to edit</p>
              )}
            </div>
          </>
        )}

        {state.selectedSection === 'networks' && (
          <div className="flex-1">
            <p className={theme.text.muted}>Networks editor coming soon</p>
          </div>
        )}

        {state.selectedSection === 'volumes' && (
          <div className="flex-1">
            <p className={theme.text.muted}>Volumes editor coming soon</p>
          </div>
        )}

        {state.selectedSection === 'secrets' && (
          <div className="flex-1">
            <p className={theme.text.muted}>Secrets editor coming soon</p>
          </div>
        )}

        {state.selectedSection === 'configs' && (
          <div className="flex-1">
            <p className={theme.text.muted}>Configs editor coming soon</p>
          </div>
        )}
      </div>
    </div>
  );
};

const ServiceEditor: React.FC<{ serviceName: string }> = ({ serviceName }) => {
  const { getServiceConfig } = useComposeEditor();
  const config = getServiceConfig(serviceName);

  if (!config) {
    return <p className={theme.text.muted}>Service not found</p>;
  }

  return (
    <div className="space-y-4">
      <h3 className={cn('text-lg font-semibold', theme.text.strong)}>{serviceName}</h3>

      <div className="grid gap-4">
        <div>
          <label className={cn('block text-sm font-medium mb-1', theme.text.muted)}>Image</label>
          <p className={theme.text.standard}>{config.image || 'Not specified'}</p>
        </div>

        {config.ports && config.ports.length > 0 && (
          <div>
            <label className={cn('block text-sm font-medium mb-1', theme.text.muted)}>Ports</label>
            <div className="space-y-1">
              {config.ports.map((port, idx) => (
                <p key={idx} className={theme.text.standard}>
                  {port.published}:{port.target}/{port.protocol}
                </p>
              ))}
            </div>
          </div>
        )}

        {config.environment && Object.keys(config.environment).length > 0 && (
          <div>
            <label className={cn('block text-sm font-medium mb-1', theme.text.muted)}>
              Environment
            </label>
            <div className="space-y-1">
              {Object.entries(config.environment).map(([key, value]) => (
                <p key={key} className={cn('text-sm font-mono', theme.text.standard)}>
                  {key}={value}
                </p>
              ))}
            </div>
          </div>
        )}

        {config.volumes && config.volumes.length > 0 && (
          <div>
            <label className={cn('block text-sm font-medium mb-1', theme.text.muted)}>
              Volumes
            </label>
            <div className="space-y-1">
              {config.volumes.map((vol, idx) => (
                <p key={idx} className={cn('text-sm font-mono', theme.text.standard)}>
                  {vol.source}:{vol.target}
                  {vol.read_only ? ' (ro)' : ''}
                </p>
              ))}
            </div>
          </div>
        )}

        <p className={cn('text-sm italic mt-4', theme.text.muted)}>
          Field editors coming soon
        </p>
      </div>
    </div>
  );
};

export const ComposeEditorModal: React.FC<ComposeEditorModalProps> = ({
  isOpen,
  onClose,
  serverId,
  stackName,
  composeFile,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Compose Editor"
      subtitle={composeFile}
      size="2xl"
      closeOnOverlayClick={false}
    >
      <ComposeEditorProvider>
        <ComposeEditorContent
          serverId={serverId}
          stackName={stackName}
          composeFile={composeFile}
          onClose={onClose}
        />
      </ComposeEditorProvider>
    </Modal>
  );
};
