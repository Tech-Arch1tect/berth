import React, { useState, useCallback } from 'react';
import { usePage } from '@inertiajs/react';
import { Modal } from '../common/Modal';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ComposeEditorProvider, useComposeEditor, EditorSection } from './ComposeEditorProvider';
import { useComposeEditorData } from './hooks/useComposeEditorData';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';
import { PortsField } from './fields/PortsField';
import { PortMappingChange } from '../../types/compose';
import { StackService } from '../../services/stackService';

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
}> = ({ serverId, stackName }) => {
  const { state, selectSection, selectService } = useComposeEditor();
  const { refetch } = useComposeEditorData({ serverId, stackName });

  const handleSaved = useCallback(() => {
    refetch();
  }, [refetch]);

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
                <ServiceEditor
                  serviceName={state.selectedService}
                  serverId={serverId}
                  stackName={stackName}
                  onSaved={handleSaved}
                />
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

interface ServiceEditorProps {
  serviceName: string;
  serverId: number;
  stackName: string;
  onSaved: () => void;
}

const ServiceEditor: React.FC<ServiceEditorProps> = ({
  serviceName,
  serverId,
  stackName,
  onSaved,
}) => {
  const { props } = usePage();
  const csrfToken = props.csrfToken as string | undefined;
  const { getServiceConfig } = useComposeEditor();
  const config = getServiceConfig(serviceName);

  const [editedPorts, setEditedPorts] = useState<PortMappingChange[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentPorts: PortMappingChange[] =
    editedPorts ??
    (config?.ports?.map((p) => ({
      target: p.target,
      published: p.published,
      host_ip: undefined,
      protocol: p.protocol,
    })) ||
      []);

  const hasChanges = editedPorts !== null;

  const handleSave = useCallback(async () => {
    if (!hasChanges) return;

    setSaving(true);
    setError(null);

    try {
      await StackService.updateCompose(
        serverId,
        stackName,
        {
          changes: {
            service_changes: {
              [serviceName]: {
                ports: editedPorts || undefined,
              },
            },
          },
        },
        csrfToken
      );
      setEditedPorts(null);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  }, [serverId, stackName, serviceName, editedPorts, hasChanges, onSaved, csrfToken]);

  const handleDiscard = useCallback(() => {
    setEditedPorts(null);
    setError(null);
  }, []);

  if (!config) {
    return <p className={theme.text.muted}>Service not found</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className={cn('text-lg font-semibold', theme.text.strong)}>{serviceName}</h3>
        {hasChanges && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleDiscard}
              disabled={saving}
              className={cn(theme.buttons.secondary, 'text-sm py-1.5 px-3')}
            >
              Discard
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className={cn(theme.buttons.primary, 'text-sm py-1.5 px-3')}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className={cn('p-3 rounded-lg text-sm', theme.alerts.variants.error)}>{error}</div>
      )}

      <div className="grid gap-6">
        <div>
          <label className={cn('block text-sm font-medium mb-1', theme.text.muted)}>Image</label>
          <p className={theme.text.standard}>{config.image || 'Not specified'}</p>
        </div>

        <PortsField ports={currentPorts} onChange={setEditedPorts} disabled={saving} />

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
        <ComposeEditorContent serverId={serverId} stackName={stackName} />
      </ComposeEditorProvider>
    </Modal>
  );
};
