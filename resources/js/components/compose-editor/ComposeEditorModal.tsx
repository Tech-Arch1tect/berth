import React, { useState, useCallback } from 'react';
import { usePage } from '@inertiajs/react';
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { Modal } from '../common/Modal';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ComposeEditorProvider, useComposeEditor, EditorSection } from './ComposeEditorProvider';
import { useComposeEditorData } from './hooks/useComposeEditorData';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';
import { PortsField } from './fields/PortsField';
import { VolumeMountsField } from './fields/VolumeMountsField';
import { HealthcheckField } from './fields/HealthcheckField';
import { DependsOnField } from './fields/DependsOnField';
import { CommandField } from './fields/CommandField';
import { DeployField } from './fields/DeployField';
import { BuildField } from './fields/BuildField';
import { ImageField } from './fields/ImageField';
import { EnvironmentField } from './fields/EnvironmentField';
import { LabelsField } from './fields/LabelsField';
import { RestartField } from './fields/RestartField';
import { NetworksField } from './fields/NetworksField';
import { NetworksEditor } from './sections/NetworksEditor';
import { VolumesEditor } from './sections/VolumesEditor';
import { SecretsConfigsEditor } from './sections/SecretsConfigsEditor';
import { AddServiceDialog } from './dialogs/AddServiceDialog';
import { RemoveServiceDialog } from './dialogs/RemoveServiceDialog';
import { RenameServiceDialog } from './dialogs/RenameServiceDialog';
import {
  PortMappingChange,
  VolumeMountChange,
  HealthcheckChange,
  DependsOnChange,
  DeployChange,
  BuildChange,
  ComposeNetworkConfig,
  ComposeVolumeConfig,
  ComposeSecretConfig,
  ComposeConfigConfig,
  NewServiceConfig,
  ServiceNetworkConfig,
} from '../../types/compose';
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
  const { props } = usePage();
  const csrfToken = props.csrfToken as string | undefined;

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [serviceToModify, setServiceToModify] = useState<string | null>(null);

  const handleSaved = useCallback(() => {
    refetch();
  }, [refetch]);

  const serviceNames = state.composeData ? Object.keys(state.composeData.services) : [];

  const handleAddService = async (name: string, config: NewServiceConfig) => {
    await StackService.updateCompose(
      serverId,
      stackName,
      { changes: { add_services: { [name]: config } } },
      csrfToken
    );
    refetch();
    selectService(name);
  };

  const handleRemoveService = async (name: string) => {
    await StackService.updateCompose(
      serverId,
      stackName,
      { changes: { delete_services: [name] } },
      csrfToken
    );
    refetch();
    if (state.selectedService === name) {
      selectService(serviceNames.find((n) => n !== name) || null);
    }
  };

  const handleRenameService = async (oldName: string, newName: string) => {
    await StackService.updateCompose(
      serverId,
      stackName,
      { changes: { rename_services: { [oldName]: newName } } },
      csrfToken
    );
    refetch();
    if (state.selectedService === oldName) {
      selectService(newName);
    }
  };

  const openRemoveDialog = (name: string) => {
    setServiceToModify(name);
    setShowRemoveDialog(true);
  };

  const openRenameDialog = (name: string) => {
    setServiceToModify(name);
    setShowRenameDialog(true);
  };

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
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center mb-4 pb-4 border-b border-zinc-200 dark:border-zinc-700 shrink-0">
        <div className="flex space-x-1">
          {SECTION_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => selectSection(tab.key)}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                state.selectedSection === tab.key
                  ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400'
                  : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 gap-4 min-h-0">
        {state.selectedSection === 'services' && (
          <>
            <div className="w-56 shrink-0 overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <h4 className={cn('text-sm font-medium', theme.text.muted)}>Services</h4>
                <button
                  type="button"
                  onClick={() => setShowAddDialog(true)}
                  className={cn(
                    'p-1 rounded',
                    'text-teal-600 hover:bg-teal-50 dark:text-teal-400 dark:hover:bg-teal-900/20'
                  )}
                  title="Add service"
                >
                  <PlusIcon className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-1">
                {serviceNames.map((name) => (
                  <div
                    key={name}
                    className={cn(
                      'group flex items-center rounded-lg transition-colors',
                      state.selectedService === name
                        ? 'bg-teal-100 dark:bg-teal-900/30'
                        : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    )}
                  >
                    <button
                      onClick={() => selectService(name)}
                      className={cn(
                        'flex-1 text-left px-3 py-2 text-sm',
                        state.selectedService === name
                          ? 'text-teal-700 dark:text-teal-400'
                          : 'text-zinc-600 dark:text-zinc-400'
                      )}
                    >
                      {name}
                    </button>
                    <div
                      className={cn(
                        'flex items-center pr-1 opacity-0 group-hover:opacity-100 transition-opacity',
                        state.selectedService === name && 'opacity-100'
                      )}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openRenameDialog(name);
                        }}
                        className={cn(
                          'p-1 rounded',
                          'text-zinc-400 hover:text-teal-600 hover:bg-teal-50',
                          'dark:hover:text-teal-400 dark:hover:bg-teal-900/30'
                        )}
                        title="Rename service"
                      >
                        <PencilIcon className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openRemoveDialog(name);
                        }}
                        className={cn(
                          'p-1 rounded',
                          'text-zinc-400 hover:text-rose-500 hover:bg-rose-50',
                          'dark:hover:bg-rose-900/20'
                        )}
                        title="Remove service"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex-1 border-l border-zinc-200 dark:border-zinc-700 pl-4 overflow-y-auto">
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
          <div className="flex-1 overflow-y-auto">
            <NetworksSectionEditor
              serverId={serverId}
              stackName={stackName}
              onSaved={handleSaved}
            />
          </div>
        )}

        {state.selectedSection === 'volumes' && (
          <div className="flex-1 overflow-y-auto">
            <VolumesSectionEditor serverId={serverId} stackName={stackName} onSaved={handleSaved} />
          </div>
        )}

        {state.selectedSection === 'secrets' && (
          <div className="flex-1 overflow-y-auto">
            <SecretsSectionEditor serverId={serverId} stackName={stackName} onSaved={handleSaved} />
          </div>
        )}

        {state.selectedSection === 'configs' && (
          <div className="flex-1 overflow-y-auto">
            <ConfigsSectionEditor serverId={serverId} stackName={stackName} onSaved={handleSaved} />
          </div>
        )}
      </div>

      {/* Service lifecycle dialogs */}
      <AddServiceDialog
        isOpen={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onAdd={handleAddService}
        existingServices={serviceNames}
      />

      {serviceToModify && (
        <>
          <RemoveServiceDialog
            isOpen={showRemoveDialog}
            onClose={() => {
              setShowRemoveDialog(false);
              setServiceToModify(null);
            }}
            onRemove={handleRemoveService}
            serviceName={serviceToModify}
            services={state.composeData?.services || {}}
          />
          <RenameServiceDialog
            isOpen={showRenameDialog}
            onClose={() => {
              setShowRenameDialog(false);
              setServiceToModify(null);
            }}
            onRename={handleRenameService}
            serviceName={serviceToModify}
            services={state.composeData?.services || {}}
          />
        </>
      )}
    </div>
  );
};

interface SectionEditorProps {
  serverId: number;
  stackName: string;
  onSaved: () => void;
}

const NetworksSectionEditor: React.FC<SectionEditorProps> = ({ serverId, stackName, onSaved }) => {
  const { props } = usePage();
  const csrfToken = props.csrfToken as string | undefined;
  const { state } = useComposeEditor();
  const [editedNetworks, setEditedNetworks] = useState<Record<string, ComposeNetworkConfig> | null>(
    null
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentNetworks = editedNetworks ?? (state.composeData?.networks || {});
  const hasChanges = editedNetworks !== null;

  const handleSave = useCallback(async () => {
    if (!hasChanges || !editedNetworks) return;
    setSaving(true);
    setError(null);
    try {
      const originalNetworks = state.composeData?.networks || {};
      const networkChanges: Record<string, ComposeNetworkConfig | null> = {};

      for (const [name, config] of Object.entries(editedNetworks)) {
        networkChanges[name] = config;
      }

      for (const name of Object.keys(originalNetworks)) {
        if (!(name in editedNetworks)) {
          networkChanges[name] = null;
        }
      }

      await StackService.updateCompose(
        serverId,
        stackName,
        { changes: { network_changes: networkChanges } },
        csrfToken
      );
      setEditedNetworks(null);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  }, [
    serverId,
    stackName,
    editedNetworks,
    state.composeData?.networks,
    hasChanges,
    onSaved,
    csrfToken,
  ]);

  const handleDiscard = useCallback(() => {
    setEditedNetworks(null);
    setError(null);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className={cn('text-lg font-semibold', theme.text.strong)}>Networks</h3>
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
      <NetworksEditor networks={currentNetworks} onChange={setEditedNetworks} disabled={saving} />
    </div>
  );
};

const VolumesSectionEditor: React.FC<SectionEditorProps> = ({ serverId, stackName, onSaved }) => {
  const { props } = usePage();
  const csrfToken = props.csrfToken as string | undefined;
  const { state } = useComposeEditor();
  const [editedVolumes, setEditedVolumes] = useState<Record<string, ComposeVolumeConfig> | null>(
    null
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentVolumes = editedVolumes ?? (state.composeData?.volumes || {});
  const hasChanges = editedVolumes !== null;

  const handleSave = useCallback(async () => {
    if (!hasChanges || !editedVolumes) return;
    setSaving(true);
    setError(null);
    try {
      const originalVolumes = state.composeData?.volumes || {};
      const volumeChanges: Record<string, ComposeVolumeConfig | null> = {};

      for (const [name, config] of Object.entries(editedVolumes)) {
        volumeChanges[name] = config;
      }
      for (const name of Object.keys(originalVolumes)) {
        if (!(name in editedVolumes)) {
          volumeChanges[name] = null;
        }
      }

      await StackService.updateCompose(
        serverId,
        stackName,
        { changes: { volume_changes: volumeChanges } },
        csrfToken
      );
      setEditedVolumes(null);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  }, [
    serverId,
    stackName,
    editedVolumes,
    state.composeData?.volumes,
    hasChanges,
    onSaved,
    csrfToken,
  ]);

  const handleDiscard = useCallback(() => {
    setEditedVolumes(null);
    setError(null);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className={cn('text-lg font-semibold', theme.text.strong)}>Volumes</h3>
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
      <VolumesEditor volumes={currentVolumes} onChange={setEditedVolumes} disabled={saving} />
    </div>
  );
};

const SecretsSectionEditor: React.FC<SectionEditorProps> = ({ serverId, stackName, onSaved }) => {
  const { props } = usePage();
  const csrfToken = props.csrfToken as string | undefined;
  const { state } = useComposeEditor();
  const [editedSecrets, setEditedSecrets] = useState<Record<string, ComposeSecretConfig> | null>(
    null
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentSecrets = editedSecrets ?? (state.composeData?.secrets || {});
  const hasChanges = editedSecrets !== null;

  const handleSave = useCallback(async () => {
    if (!hasChanges || !editedSecrets) return;
    setSaving(true);
    setError(null);
    try {
      const originalSecrets = state.composeData?.secrets || {};
      const secretChanges: Record<string, ComposeSecretConfig | null> = {};

      for (const [name, config] of Object.entries(editedSecrets)) {
        secretChanges[name] = config;
      }
      for (const name of Object.keys(originalSecrets)) {
        if (!(name in editedSecrets)) {
          secretChanges[name] = null;
        }
      }

      await StackService.updateCompose(
        serverId,
        stackName,
        { changes: { secret_changes: secretChanges } },
        csrfToken
      );
      setEditedSecrets(null);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  }, [
    serverId,
    stackName,
    editedSecrets,
    state.composeData?.secrets,
    hasChanges,
    onSaved,
    csrfToken,
  ]);

  const handleDiscard = useCallback(() => {
    setEditedSecrets(null);
    setError(null);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className={cn('text-lg font-semibold', theme.text.strong)}>Secrets</h3>
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
      <SecretsConfigsEditor
        resources={currentSecrets}
        onChange={setEditedSecrets}
        resourceType="secrets"
        disabled={saving}
      />
    </div>
  );
};

const ConfigsSectionEditor: React.FC<SectionEditorProps> = ({ serverId, stackName, onSaved }) => {
  const { props } = usePage();
  const csrfToken = props.csrfToken as string | undefined;
  const { state } = useComposeEditor();
  const [editedConfigs, setEditedConfigs] = useState<Record<string, ComposeConfigConfig> | null>(
    null
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentConfigs = editedConfigs ?? (state.composeData?.configs || {});
  const hasChanges = editedConfigs !== null;

  const handleSave = useCallback(async () => {
    if (!hasChanges || !editedConfigs) return;
    setSaving(true);
    setError(null);
    try {
      const originalConfigs = state.composeData?.configs || {};
      const configChanges: Record<string, ComposeConfigConfig | null> = {};

      for (const [name, config] of Object.entries(editedConfigs)) {
        configChanges[name] = config;
      }
      for (const name of Object.keys(originalConfigs)) {
        if (!(name in editedConfigs)) {
          configChanges[name] = null;
        }
      }

      await StackService.updateCompose(
        serverId,
        stackName,
        { changes: { config_changes: configChanges } },
        csrfToken
      );
      setEditedConfigs(null);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  }, [
    serverId,
    stackName,
    editedConfigs,
    state.composeData?.configs,
    hasChanges,
    onSaved,
    csrfToken,
  ]);

  const handleDiscard = useCallback(() => {
    setEditedConfigs(null);
    setError(null);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className={cn('text-lg font-semibold', theme.text.strong)}>Configs</h3>
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
      <SecretsConfigsEditor
        resources={currentConfigs}
        onChange={setEditedConfigs}
        resourceType="configs"
        disabled={saving}
      />
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
  const { state, getServiceConfig } = useComposeEditor();
  const config = getServiceConfig(serviceName);
  const availableServices = state.composeData ? Object.keys(state.composeData.services) : [];

  const [editedPorts, setEditedPorts] = useState<PortMappingChange[] | null>(null);
  const [editedVolumes, setEditedVolumes] = useState<VolumeMountChange[] | null>(null);
  const [editedHealthcheck, setEditedHealthcheck] = useState<HealthcheckChange | null | undefined>(
    undefined
  );
  const [editedDependsOn, setEditedDependsOn] = useState<Record<string, DependsOnChange> | null>(
    null
  );
  const [editedCommand, setEditedCommand] = useState<string[] | null | undefined>(undefined);
  const [editedEntrypoint, setEditedEntrypoint] = useState<string[] | null | undefined>(undefined);
  const [editedDeploy, setEditedDeploy] = useState<DeployChange | null | undefined>(undefined);
  const [editedBuild, setEditedBuild] = useState<BuildChange | null | undefined>(undefined);
  const [editedImage, setEditedImage] = useState<string | undefined>(undefined);
  const [editedEnvironment, setEditedEnvironment] = useState<Record<string, string> | null>(null);
  const [editedLabels, setEditedLabels] = useState<Record<string, string> | null>(null);
  const [editedRestart, setEditedRestart] = useState<string | undefined>(undefined);
  const [editedNetworks, setEditedNetworks] = useState<Record<
    string,
    ServiceNetworkConfig | null
  > | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableNetworks = state.composeData ? Object.keys(state.composeData.networks || {}) : [];

  const currentPorts: PortMappingChange[] =
    editedPorts ??
    (config?.ports?.map((p) => ({
      target: p.target,
      published: p.published,
      host_ip: undefined,
      protocol: p.protocol,
    })) ||
      []);

  const currentVolumes: VolumeMountChange[] =
    editedVolumes ??
    (config?.volumes?.map((v) => ({
      type: v.type || 'bind',
      source: v.source,
      target: v.target,
      read_only: v.read_only,
    })) ||
      []);

  const currentHealthcheck: HealthcheckChange | null =
    editedHealthcheck !== undefined
      ? editedHealthcheck
      : config?.healthcheck
        ? {
            test: config.healthcheck.test,
            interval: config.healthcheck.interval,
            timeout: config.healthcheck.timeout,
            retries: config.healthcheck.retries,
            start_period: config.healthcheck.start_period,
            start_interval: config.healthcheck.start_interval,
            disable: config.healthcheck.disable,
          }
        : null;

  const currentDependsOn: Record<string, DependsOnChange> =
    editedDependsOn ??
    (config?.depends_on
      ? Object.fromEntries(
          Object.entries(config.depends_on).map(([name, dep]) => [
            name,
            { condition: dep.condition, restart: dep.restart, required: dep.required },
          ])
        )
      : {});

  const currentCommand: string[] | null =
    editedCommand !== undefined ? editedCommand : (config?.command ?? null);

  const currentEntrypoint: string[] | null =
    editedEntrypoint !== undefined ? editedEntrypoint : (config?.entrypoint ?? null);

  const currentDeploy: DeployChange | null =
    editedDeploy !== undefined ? editedDeploy : (config?.deploy ?? null);

  const currentBuild: BuildChange | null =
    editedBuild !== undefined
      ? editedBuild
      : config?.build
        ? {
            context: config.build.context,
            dockerfile: config.build.dockerfile,
            args: config.build.args,
            target: config.build.target,
            cache_from: config.build.cache_from,
          }
        : null;

  const currentImage: string | undefined = editedImage !== undefined ? editedImage : config?.image;

  const currentEnvironment: Record<string, string> =
    editedEnvironment ?? (config?.environment || {});

  const currentLabels: Record<string, string> = editedLabels ?? (config?.labels || {});

  const currentRestart: string | undefined =
    editedRestart !== undefined ? editedRestart : config?.restart;

  const currentNetworks: Record<string, ServiceNetworkConfig | null> =
    editedNetworks ??
    (config?.networks
      ? Object.fromEntries(
          Object.entries(config.networks).map(([name, net]) => [
            name,
            net ? { aliases: net.aliases, ipv4_address: net.ipv4_address } : null,
          ])
        )
      : {});

  const hasChanges =
    editedPorts !== null ||
    editedVolumes !== null ||
    editedHealthcheck !== undefined ||
    editedDependsOn !== null ||
    editedCommand !== undefined ||
    editedEntrypoint !== undefined ||
    editedImage !== undefined ||
    editedEnvironment !== null ||
    editedLabels !== null ||
    editedRestart !== undefined ||
    editedNetworks !== null ||
    editedDeploy !== undefined ||
    editedBuild !== undefined;

  const handleSave = useCallback(async () => {
    if (!hasChanges) return;

    setSaving(true);
    setError(null);

    try {
      let environmentChanges: Record<string, string | null> | undefined = undefined;
      if (editedEnvironment !== null) {
        const originalEnv = config?.environment || {};
        environmentChanges = {};

        for (const [key, value] of Object.entries(editedEnvironment)) {
          environmentChanges[key] = value;
        }

        for (const key of Object.keys(originalEnv)) {
          if (!(key in editedEnvironment)) {
            environmentChanges[key] = null;
          }
        }
      }

      let labelsChanges: Record<string, string | null> | undefined = undefined;
      if (editedLabels !== null) {
        const originalLabels = config?.labels || {};
        labelsChanges = {};
        for (const [key, value] of Object.entries(editedLabels)) {
          labelsChanges[key] = value;
        }
        for (const key of Object.keys(originalLabels)) {
          if (!(key in editedLabels)) {
            labelsChanges[key] = null;
          }
        }
      }

      await StackService.updateCompose(
        serverId,
        stackName,
        {
          changes: {
            service_changes: {
              [serviceName]: {
                image: editedImage,
                ports: editedPorts || undefined,
                volumes: editedVolumes || undefined,
                environment: environmentChanges,
                labels: labelsChanges,
                restart: editedRestart,
                networks: editedNetworks || undefined,
                healthcheck:
                  editedHealthcheck !== undefined ? (editedHealthcheck ?? undefined) : undefined,
                depends_on: editedDependsOn || undefined,
                command: editedCommand !== undefined ? { values: editedCommand || [] } : undefined,
                entrypoint:
                  editedEntrypoint !== undefined ? { values: editedEntrypoint || [] } : undefined,
                deploy: editedDeploy !== undefined ? (editedDeploy ?? undefined) : undefined,
                build: editedBuild !== undefined ? (editedBuild ?? undefined) : undefined,
              },
            },
          },
        },
        csrfToken
      );
      setEditedPorts(null);
      setEditedVolumes(null);
      setEditedHealthcheck(undefined);
      setEditedDependsOn(null);
      setEditedCommand(undefined);
      setEditedEntrypoint(undefined);
      setEditedDeploy(undefined);
      setEditedBuild(undefined);
      setEditedImage(undefined);
      setEditedEnvironment(null);
      setEditedLabels(null);
      setEditedRestart(undefined);
      setEditedNetworks(null);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  }, [
    serverId,
    stackName,
    serviceName,
    config,
    editedPorts,
    editedVolumes,
    editedHealthcheck,
    editedDependsOn,
    editedCommand,
    editedEntrypoint,
    editedDeploy,
    editedBuild,
    editedImage,
    editedEnvironment,
    editedLabels,
    editedRestart,
    editedNetworks,
    hasChanges,
    onSaved,
    csrfToken,
  ]);

  const handleDiscard = useCallback(() => {
    setEditedPorts(null);
    setEditedVolumes(null);
    setEditedHealthcheck(undefined);
    setEditedDependsOn(null);
    setEditedCommand(undefined);
    setEditedEntrypoint(undefined);
    setEditedDeploy(undefined);
    setEditedBuild(undefined);
    setEditedImage(undefined);
    setEditedEnvironment(null);
    setEditedLabels(null);
    setEditedRestart(undefined);
    setEditedNetworks(null);
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
        <ImageField image={currentImage} onChange={setEditedImage} disabled={saving} />

        <RestartField restart={currentRestart} onChange={setEditedRestart} disabled={saving} />

        <PortsField ports={currentPorts} onChange={setEditedPorts} disabled={saving} />

        <VolumeMountsField volumes={currentVolumes} onChange={setEditedVolumes} disabled={saving} />

        <EnvironmentField
          environment={currentEnvironment}
          onChange={setEditedEnvironment}
          disabled={saving}
        />

        <LabelsField labels={currentLabels} onChange={setEditedLabels} disabled={saving} />

        <NetworksField
          networks={currentNetworks}
          availableNetworks={availableNetworks}
          onChange={setEditedNetworks}
          disabled={saving}
        />

        <HealthcheckField
          healthcheck={currentHealthcheck}
          onChange={setEditedHealthcheck}
          disabled={saving}
        />

        <DependsOnField
          dependsOn={currentDependsOn}
          availableServices={availableServices}
          currentService={serviceName}
          onChange={setEditedDependsOn}
          disabled={saving}
        />

        <CommandField
          label="Command"
          values={currentCommand}
          onChange={setEditedCommand}
          disabled={saving}
          placeholder="e.g., npm start"
        />

        <CommandField
          label="Entrypoint"
          values={currentEntrypoint}
          onChange={setEditedEntrypoint}
          disabled={saving}
          placeholder="e.g., /docker-entrypoint.sh"
        />

        <DeployField deploy={currentDeploy} onChange={setEditedDeploy} disabled={saving} />

        <BuildField build={currentBuild} onChange={setEditedBuild} disabled={saving} />
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
      childrenHandleScroll
    >
      <ComposeEditorProvider>
        <ComposeEditorContent serverId={serverId} stackName={stackName} />
      </ComposeEditorProvider>
    </Modal>
  );
};
