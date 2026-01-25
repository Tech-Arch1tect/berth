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
import { DiffPreviewView } from './views/DiffPreviewView';
import {
  ComposePort,
  ComposeVolumeMount,
  PortMappingChange,
  VolumeMountChange,
  HealthcheckChange,
  DependsOnChange,
  DeployChange,
  BuildChange,
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
  { key: 'preview', label: 'Preview' },
];

const ComposeEditorContent: React.FC<{
  serverId: number;
  stackName: string;
}> = ({ serverId, stackName }) => {
  const {
    state,
    isDirty,
    apiChanges,
    selectSection,
    selectService,
    addService,
    deleteService,
    renameService,
    resetChanges,
    clearChangesAfterSave,
  } = useComposeEditor();
  const { refetch } = useComposeEditorData({ serverId, stackName });
  const { props } = usePage();
  const csrfToken = props.csrfToken as string | undefined;

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [serviceToModify, setServiceToModify] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getEffectiveServiceNames = useCallback((): string[] => {
    const original = state.composeData ? Object.keys(state.composeData.services) : [];
    const added = Object.keys(state.pendingChanges.addServices);
    const deleted = state.pendingChanges.deleteServices;
    const renamed = state.pendingChanges.renameServices;

    let services = original.filter((name) => !deleted.includes(name));

    services = services.map((name) => renamed[name] || name);

    services = [...services, ...added];

    return services.sort();
  }, [state.composeData, state.pendingChanges]);

  const serviceNames = getEffectiveServiceNames();

  const handleAddService = useCallback(
    async (name: string, config: NewServiceConfig) => {
      addService(name, config);
      selectService(name);
      setShowAddDialog(false);
    },
    [addService, selectService]
  );

  const handleRemoveService = useCallback(
    async (name: string) => {
      deleteService(name);
      if (state.selectedService === name) {
        const remaining = serviceNames.filter((n) => n !== name);
        selectService(remaining.length > 0 ? remaining[0] : null);
      }
      setShowRemoveDialog(false);
      setServiceToModify(null);
    },
    [deleteService, selectService, state.selectedService, serviceNames]
  );

  const handleRenameService = useCallback(
    async (oldName: string, newName: string) => {
      renameService(oldName, newName);
      if (state.selectedService === oldName) {
        selectService(newName);
      }
      setShowRenameDialog(false);
      setServiceToModify(null);
    },
    [renameService, selectService, state.selectedService]
  );

  const handleSaveAll = useCallback(async () => {
    if (!isDirty) return;

    setSaving(true);
    setError(null);

    try {
      await StackService.updateCompose(serverId, stackName, { changes: apiChanges });
      clearChangesAfterSave();
      refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  }, [serverId, stackName, apiChanges, isDirty, csrfToken, clearChangesAfterSave, refetch]);

  const handleDiscardAll = useCallback(() => {
    resetChanges();
    setError(null);
  }, [resetChanges]);

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
      {/* Header with tabs and global save/discard */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-zinc-200 dark:border-zinc-700 shrink-0">
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

        {/* Global Save/Discard controls */}
        <div className="flex items-center gap-2">
          {isDirty && (
            <>
              <span className={cn('text-xs', theme.text.muted)}>Unsaved changes</span>
              <button
                onClick={handleDiscardAll}
                disabled={saving}
                className={cn(theme.buttons.secondary, 'text-sm py-1.5 px-3')}
              >
                Discard All
              </button>
            </>
          )}
          {isDirty && !state.previewViewed ? (
            <button
              onClick={() => selectSection('preview')}
              disabled={saving}
              className={cn(theme.buttons.primary, 'text-sm py-1.5 px-3')}
            >
              Preview Changes
            </button>
          ) : (
            <button
              onClick={handleSaveAll}
              disabled={saving || !isDirty}
              className={cn(theme.buttons.primary, 'text-sm py-1.5 px-3')}
            >
              {saving ? 'Saving...' : 'Save All Changes'}
            </button>
          )}
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className={cn('mb-4 p-3 rounded-lg text-sm', theme.alerts.variants.error)}>
          {error}
        </div>
      )}

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
                {serviceNames.map((name) => {
                  const isDeleted = state.pendingChanges.deleteServices.includes(name);
                  const isAdded = name in state.pendingChanges.addServices;
                  const isRenamed = Object.values(state.pendingChanges.renameServices).includes(
                    name
                  );

                  if (isDeleted) return null;

                  return (
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
                        {isAdded && (
                          <span className="ml-1 text-xs text-teal-500 dark:text-teal-400">
                            (new)
                          </span>
                        )}
                        {isRenamed && (
                          <span className="ml-1 text-xs text-amber-500 dark:text-amber-400">
                            (renamed)
                          </span>
                        )}
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
                  );
                })}
              </div>
            </div>
            <div className="flex-1 border-l border-zinc-200 dark:border-zinc-700 pl-4 overflow-y-auto">
              {state.selectedService ? (
                <ServiceEditor serviceName={state.selectedService} disabled={saving} />
              ) : (
                <p className={theme.text.muted}>Select a service to edit</p>
              )}
            </div>
          </>
        )}

        {state.selectedSection === 'networks' && (
          <div className="flex-1 overflow-y-auto">
            <NetworksSectionEditor disabled={saving} />
          </div>
        )}

        {state.selectedSection === 'volumes' && (
          <div className="flex-1 overflow-y-auto">
            <VolumesSectionEditor disabled={saving} />
          </div>
        )}

        {state.selectedSection === 'secrets' && (
          <div className="flex-1 overflow-y-auto">
            <SecretsSectionEditor disabled={saving} />
          </div>
        )}

        {state.selectedSection === 'configs' && (
          <div className="flex-1 overflow-y-auto">
            <ConfigsSectionEditor disabled={saving} />
          </div>
        )}

        {state.selectedSection === 'preview' && (
          <div className="flex-1 overflow-y-auto">
            <DiffPreviewView
              serverId={serverId}
              stackName={stackName}
              changes={apiChanges}
              csrfToken={csrfToken}
              hasChanges={isDirty}
            />
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
  disabled: boolean;
}

const NetworksSectionEditor: React.FC<SectionEditorProps> = ({ disabled }) => {
  const { getEffectiveNetworks, setNetworks, state } = useComposeEditor();

  const currentNetworks = getEffectiveNetworks();

  const handleChange = useCallback(
    (networks: Record<string, unknown>) => {
      const original = state.composeData?.networks || {};
      const changes: Record<string, unknown | null> = {};

      for (const [name, config] of Object.entries(networks)) {
        changes[name] = config;
      }

      for (const name of Object.keys(original)) {
        if (!(name in networks)) {
          changes[name] = null;
        }
      }

      setNetworks(changes as Parameters<typeof setNetworks>[0]);
    },
    [setNetworks, state.composeData?.networks]
  );

  return (
    <div className="space-y-4">
      <h3 className={cn('text-lg font-semibold', theme.text.strong)}>Networks</h3>
      <NetworksEditor networks={currentNetworks} onChange={handleChange} disabled={disabled} />
    </div>
  );
};

const VolumesSectionEditor: React.FC<SectionEditorProps> = ({ disabled }) => {
  const { getEffectiveVolumes, setVolumes, state } = useComposeEditor();

  const currentVolumes = getEffectiveVolumes();

  const handleChange = useCallback(
    (volumes: Record<string, unknown>) => {
      const original = state.composeData?.volumes || {};
      const changes: Record<string, unknown | null> = {};

      for (const [name, config] of Object.entries(volumes)) {
        changes[name] = config;
      }

      for (const name of Object.keys(original)) {
        if (!(name in volumes)) {
          changes[name] = null;
        }
      }

      setVolumes(changes as Parameters<typeof setVolumes>[0]);
    },
    [setVolumes, state.composeData?.volumes]
  );

  return (
    <div className="space-y-4">
      <h3 className={cn('text-lg font-semibold', theme.text.strong)}>Volumes</h3>
      <VolumesEditor volumes={currentVolumes} onChange={handleChange} disabled={disabled} />
    </div>
  );
};

const SecretsSectionEditor: React.FC<SectionEditorProps> = ({ disabled }) => {
  const { getEffectiveSecrets, setSecrets, state } = useComposeEditor();

  const currentSecrets = getEffectiveSecrets();

  const handleChange = useCallback(
    (secrets: Record<string, unknown>) => {
      const original = state.composeData?.secrets || {};
      const changes: Record<string, unknown | null> = {};

      for (const [name, config] of Object.entries(secrets)) {
        changes[name] = config;
      }

      for (const name of Object.keys(original)) {
        if (!(name in secrets)) {
          changes[name] = null;
        }
      }

      setSecrets(changes as Parameters<typeof setSecrets>[0]);
    },
    [setSecrets, state.composeData?.secrets]
  );

  return (
    <div className="space-y-4">
      <h3 className={cn('text-lg font-semibold', theme.text.strong)}>Secrets</h3>
      <SecretsConfigsEditor
        resources={currentSecrets}
        onChange={handleChange}
        resourceType="secrets"
        disabled={disabled}
      />
    </div>
  );
};

const ConfigsSectionEditor: React.FC<SectionEditorProps> = ({ disabled }) => {
  const { getEffectiveConfigs, setConfigs, state } = useComposeEditor();

  const currentConfigs = getEffectiveConfigs();

  const handleChange = useCallback(
    (configs: Record<string, unknown>) => {
      const original = state.composeData?.configs || {};
      const changes: Record<string, unknown | null> = {};

      for (const [name, config] of Object.entries(configs)) {
        changes[name] = config;
      }

      for (const name of Object.keys(original)) {
        if (!(name in configs)) {
          changes[name] = null;
        }
      }

      setConfigs(changes as Parameters<typeof setConfigs>[0]);
    },
    [setConfigs, state.composeData?.configs]
  );

  return (
    <div className="space-y-4">
      <h3 className={cn('text-lg font-semibold', theme.text.strong)}>Configs</h3>
      <SecretsConfigsEditor
        resources={currentConfigs}
        onChange={handleChange}
        resourceType="configs"
        disabled={disabled}
      />
    </div>
  );
};

interface ServiceEditorProps {
  serviceName: string;
  disabled: boolean;
}

const ServiceEditor: React.FC<ServiceEditorProps> = ({ serviceName, disabled }) => {
  const { state, getServiceConfig, updateService, getEffectiveNetworks, getEffectiveVolumes } =
    useComposeEditor();
  const config = getServiceConfig(serviceName);

  const availableServices = state.composeData ? Object.keys(state.composeData.services) : [];
  const availableNetworks = Object.keys(getEffectiveNetworks());
  const availableVolumes = Object.keys(getEffectiveVolumes());

  const currentPorts: ComposePort[] = config?.ports || [];

  const currentVolumes: ComposeVolumeMount[] = config?.volumes || [];

  const currentHealthcheck: HealthcheckChange | null = config?.healthcheck
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

  const currentDependsOn: Record<string, DependsOnChange> = config?.depends_on
    ? Object.fromEntries(
        Object.entries(config.depends_on).map(([name, dep]) => [
          name,
          { condition: dep.condition, restart: dep.restart, required: dep.required },
        ])
      )
    : {};

  const currentCommand: string[] | null = config?.command ?? null;
  const currentEntrypoint: string[] | null = config?.entrypoint ?? null;
  const currentDeploy: DeployChange | null = config?.deploy ?? null;
  const currentBuild: BuildChange | null = config?.build
    ? {
        context: config.build.context,
        dockerfile: config.build.dockerfile,
        args: config.build.args,
        target: config.build.target,
        cache_from: config.build.cache_from,
      }
    : null;
  const currentImage: string | undefined = config?.image;
  const currentEnvironment: Record<string, string> = config?.environment || {};
  const currentLabels: Record<string, string> = config?.labels || {};
  const currentRestart: string | undefined = config?.restart;

  const currentNetworks: Record<string, ServiceNetworkConfig | null> = config?.networks
    ? Object.fromEntries(
        Object.entries(config.networks).map(([name, net]) => [
          name,
          net ? { aliases: net.aliases, ipv4_address: net.ipv4_address } : null,
        ])
      )
    : {};

  const handleImageChange = useCallback(
    (image: string | undefined) => {
      if (image !== undefined) {
        updateService(serviceName, { image });
      }
    },
    [serviceName, updateService]
  );

  const handlePortsChange = useCallback(
    (ports: ComposePort[] | null) => {
      if (ports !== null) {
        const portChanges: PortMappingChange[] = ports.map((p) => ({
          target: p.target,
          published: p.published,
          host_ip: p.host_ip,
          protocol: p.protocol,
        }));
        updateService(serviceName, { ports: portChanges });
      }
    },
    [serviceName, updateService]
  );

  const handleVolumesChange = useCallback(
    (volumes: ComposeVolumeMount[] | null) => {
      if (volumes !== null) {
        const volumeChanges: VolumeMountChange[] = volumes.map((v) => ({
          type: v.type || 'bind',
          source: v.source,
          target: v.target,
          read_only: v.read_only,
        }));
        updateService(serviceName, { volumes: volumeChanges });
      }
    },
    [serviceName, updateService]
  );

  const handleEnvironmentChange = useCallback(
    (environment: Record<string, string> | null) => {
      if (environment !== null) {
        const originalEnv = state.composeData?.services[serviceName]?.environment || {};
        const envChanges: Record<string, string | null> = {};

        for (const [key, value] of Object.entries(environment)) {
          envChanges[key] = value;
        }

        for (const key of Object.keys(originalEnv)) {
          if (!(key in environment)) {
            envChanges[key] = null;
          }
        }

        updateService(serviceName, { environment: envChanges });
      }
    },
    [serviceName, updateService, state.composeData?.services]
  );

  const handleLabelsChange = useCallback(
    (labels: Record<string, string> | null) => {
      if (labels !== null) {
        const originalLabels = state.composeData?.services[serviceName]?.labels || {};
        const labelChanges: Record<string, string | null> = {};

        for (const [key, value] of Object.entries(labels)) {
          labelChanges[key] = value;
        }

        for (const key of Object.keys(originalLabels)) {
          if (!(key in labels)) {
            labelChanges[key] = null;
          }
        }

        updateService(serviceName, { labels: labelChanges });
      }
    },
    [serviceName, updateService, state.composeData?.services]
  );

  const handleRestartChange = useCallback(
    (restart: string | undefined) => {
      if (restart !== undefined) {
        updateService(serviceName, { restart });
      }
    },
    [serviceName, updateService]
  );

  const handleNetworksChange = useCallback(
    (networks: Record<string, ServiceNetworkConfig | null> | null) => {
      if (networks !== null) {
        updateService(serviceName, { networks });
      }
    },
    [serviceName, updateService]
  );

  const handleHealthcheckChange = useCallback(
    (healthcheck: HealthcheckChange | null | undefined) => {
      if (healthcheck !== undefined) {
        updateService(serviceName, { healthcheck: healthcheck ?? undefined });
      }
    },
    [serviceName, updateService]
  );

  const handleDependsOnChange = useCallback(
    (dependsOn: Record<string, DependsOnChange> | null) => {
      if (dependsOn !== null) {
        updateService(serviceName, { depends_on: dependsOn });
      }
    },
    [serviceName, updateService]
  );

  const handleCommandChange = useCallback(
    (command: string[] | null | undefined) => {
      if (command !== undefined) {
        updateService(serviceName, { command: { values: command || [] } });
      }
    },
    [serviceName, updateService]
  );

  const handleEntrypointChange = useCallback(
    (entrypoint: string[] | null | undefined) => {
      if (entrypoint !== undefined) {
        updateService(serviceName, { entrypoint: { values: entrypoint || [] } });
      }
    },
    [serviceName, updateService]
  );

  const handleDeployChange = useCallback(
    (deploy: DeployChange | null | undefined) => {
      if (deploy !== undefined) {
        updateService(serviceName, { deploy: deploy ?? undefined });
      }
    },
    [serviceName, updateService]
  );

  const handleBuildChange = useCallback(
    (build: BuildChange | null | undefined) => {
      if (build !== undefined) {
        updateService(serviceName, { build: build ?? undefined });
      }
    },
    [serviceName, updateService]
  );

  if (!config) {
    return <p className={theme.text.muted}>Service not found</p>;
  }

  return (
    <div className="space-y-4">
      <h3 className={cn('text-lg font-semibold', theme.text.strong)}>{serviceName}</h3>

      <div className="grid gap-6">
        <ImageField image={currentImage} onChange={handleImageChange} disabled={disabled} />

        <RestartField restart={currentRestart} onChange={handleRestartChange} disabled={disabled} />

        <PortsField ports={currentPorts} onChange={handlePortsChange} disabled={disabled} />

        <VolumeMountsField
          volumes={currentVolumes}
          availableVolumes={availableVolumes}
          onChange={handleVolumesChange}
          disabled={disabled}
        />

        <EnvironmentField
          environment={currentEnvironment}
          onChange={handleEnvironmentChange}
          disabled={disabled}
        />

        <LabelsField labels={currentLabels} onChange={handleLabelsChange} disabled={disabled} />

        <NetworksField
          networks={currentNetworks}
          availableNetworks={availableNetworks}
          onChange={handleNetworksChange}
          disabled={disabled}
        />

        <HealthcheckField
          healthcheck={currentHealthcheck}
          onChange={handleHealthcheckChange}
          disabled={disabled}
        />

        <DependsOnField
          dependsOn={currentDependsOn}
          availableServices={availableServices}
          currentService={serviceName}
          onChange={handleDependsOnChange}
          disabled={disabled}
        />

        <CommandField
          label="Command"
          values={currentCommand}
          onChange={handleCommandChange}
          disabled={disabled}
          placeholder="e.g., npm start"
        />

        <CommandField
          label="Entrypoint"
          values={currentEntrypoint}
          onChange={handleEntrypointChange}
          disabled={disabled}
          placeholder="e.g., /docker-entrypoint.sh"
        />

        <DeployField deploy={currentDeploy} onChange={handleDeployChange} disabled={disabled} />

        <BuildField build={currentBuild} onChange={handleBuildChange} disabled={disabled} />
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
