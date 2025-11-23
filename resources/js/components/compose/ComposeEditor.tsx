import React, { useState } from 'react';
import axios from 'axios';
import { usePage } from '@inertiajs/react';
import { ComposeService } from '../../types/stack';
import { ServiceImageEditor } from './ServiceImageEditor';
import { ServicePortsEditor } from './ServicePortsEditor';
import { ServiceEnvironmentEditor } from './ServiceEnvironmentEditor';
import { ComposeDiffModal } from './ComposeDiffModal';
import { XMarkIcon, CheckIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { useComposeEditor } from '../../hooks/useComposeEditor';
import { useStackEnvironmentVariables } from '../../hooks/useStackEnvironmentVariables';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';
import { getServicePortBaseline } from '../../utils/portUtils';
import { showToast } from '../../utils/toast';

export interface ComposeChanges {
  service_image_updates?: Array<{
    service_name: string;
    new_image?: string;
    new_tag?: string;
  }>;
  service_port_updates?: Array<{
    service_name: string;
    ports: string[];
  }>;
  service_env_updates?: Array<{
    service_name: string;
    environment: Array<{
      key: string;
      value: string;
      is_sensitive: boolean;
    }>;
  }>;
}

interface ComposeEditorProps {
  services: ComposeService[];
  serverId: number;
  stackName: string;
  onUpdate: (changes: ComposeChanges) => Promise<void>;
  onClose: () => void;
}

const buildUpdatedImageValue = (
  service: ComposeService,
  update?: { new_image?: string; new_tag?: string }
): string | null => {
  if (!update) {
    return null;
  }

  if (update.new_image) {
    return update.new_image;
  }

  if (update.new_tag) {
    if (!service.image) {
      return update.new_tag;
    }

    const pivot = service.image.lastIndexOf(':');
    return pivot === -1
      ? `${service.image}:${update.new_tag}`
      : `${service.image.substring(0, pivot)}:${update.new_tag}`;
  }

  return null;
};

const serviceHasPendingChanges = (changes: ComposeChanges, serviceName: string): boolean => {
  const imageChange = changes.service_image_updates?.some(
    (update) => update.service_name === serviceName
  );
  const portChange = changes.service_port_updates?.some(
    (update) => update.service_name === serviceName
  );
  const envChange = changes.service_env_updates?.some(
    (update) => update.service_name === serviceName
  );
  return Boolean(imageChange || portChange || envChange);
};

export const ComposeEditor: React.FC<ComposeEditorProps> = ({
  services,
  serverId,
  stackName,
  onUpdate,
  onClose,
}) => {
  const editor = useComposeEditor(services, onUpdate);
  const { props } = usePage();
  const csrfToken = props.csrfToken as string | undefined;
  const [showDiffModal, setShowDiffModal] = useState(false);
  const [diffData, setDiffData] = useState<{ original: string; preview: string } | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const { data: composeEnvironment } = useStackEnvironmentVariables({
    serverid: serverId,
    stackname: stackName,
  });

  const handleSave = async () => {
    if (!editor.hasChanges) {
      showToast.error('No changes to save');
      return;
    }

    setIsLoadingPreview(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      };
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }

      const response = await axios.post(
        `/api/v1/servers/${serverId}/stacks/${stackName}/compose/preview`,
        { changes: editor.changes },
        { headers }
      );
      setDiffData(response.data);
      setShowDiffModal(true);
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.error || error?.message || 'Failed to generate preview';
      showToast.error(errorMessage);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleConfirmSave = async () => {
    const success = await editor.handleSave();
    if (success) {
      setShowDiffModal(false);
      onClose();
    }
  };

  const pendingImageUpdate = editor.currentService
    ? editor.changes.service_image_updates?.find(
        (entry) => entry.service_name === editor.currentService!.name
      )
    : undefined;

  const pendingPortUpdate = editor.currentService
    ? editor.changes.service_port_updates?.find(
        (entry) => entry.service_name === editor.currentService!.name
      )
    : undefined;

  const pendingEnvironmentUpdate = editor.currentService
    ? editor.changes.service_env_updates?.find(
        (entry) => entry.service_name === editor.currentService!.name
      )
    : undefined;

  const currentPortsInfo = editor.currentService
    ? getServicePortBaseline(editor.currentService)
    : { ports: [], source: 'none' as const };
  const { ports: displayedCurrentPorts, source: portSource } = currentPortsInfo;

  const currentEnvironment =
    editor.currentService && composeEnvironment && composeEnvironment[editor.currentService.name]
      ? composeEnvironment[editor.currentService.name]
          .flatMap((env) => env.variables)
          .filter((variable) => variable.source === 'compose')
      : [];

  const updatedImageValue = editor.currentService
    ? buildUpdatedImageValue(editor.currentService, pendingImageUpdate)
    : null;

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-zinc-900/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-6xl h-[90vh] max-h-[900px] z-10">
        <div className="pointer-events-auto w-full h-full">
          <div
            className={cn(
              'flex h-full flex-col shadow-2xl rounded-2xl overflow-hidden dark:shadow-black/40',
              theme.containers.panel
            )}
          >
            <div className={cn(theme.brand.composeHeader, 'px-6 py-6')}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white">Compose Editor</h2>
                  <p className="mt-1 text-sm text-white/80">
                    Edit your Docker Compose configuration
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="rounded-lg bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
              <div
                className={cn(
                  'w-64 border-r overflow-y-auto',
                  theme.surface.muted,
                  'border-zinc-200 dark:border-zinc-800'
                )}
              >
                <div className="p-4">
                  <h3
                    className={cn(
                      'text-sm font-bold uppercase tracking-wider mb-3',
                      theme.text.standard
                    )}
                  >
                    Services
                  </h3>
                  <div className="space-y-1">
                    {services.map((service) => (
                      <button
                        key={service.name}
                        onClick={() => editor.setSelectedService(service.name)}
                        className={cn(
                          'w-full text-left px-4 py-3 rounded-lg transition-all duration-200',
                          editor.selectedService === service.name
                            ? theme.brand.composeSelected
                            : cn(theme.text.standard, 'hover:bg-zinc-100 dark:hover:bg-zinc-800')
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{service.name}</span>
                          {serviceHasPendingChanges(editor.changes, service.name) && (
                            <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                          )}
                        </div>
                        {service.image && (
                          <div className="text-xs mt-1 opacity-75 truncate">{service.image}</div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {!editor.currentService && (
                  <div className={cn('h-full flex items-center justify-center', theme.text.muted)}>
                    No service selected
                  </div>
                )}

                {editor.currentService && editor.activeEditor === 'image' && (
                  <ServiceImageEditor
                    service={editor.currentService}
                    onUpdate={editor.queueImageUpdate}
                    onBack={() => editor.setActiveEditor(null)}
                  />
                )}

                {editor.currentService && editor.activeEditor === 'ports' && (
                  <ServicePortsEditor
                    service={editor.currentService}
                    pendingPorts={pendingPortUpdate?.ports}
                    onApply={editor.queuePortUpdate}
                    onCancel={() => editor.setActiveEditor(null)}
                  />
                )}

                {editor.currentService && editor.activeEditor === 'environment' && (
                  <ServiceEnvironmentEditor
                    service={editor.currentService}
                    serverId={serverId}
                    stackName={stackName}
                    pendingEnvironment={pendingEnvironmentUpdate?.environment}
                    onApply={editor.queueEnvironmentUpdate}
                    onCancel={() => editor.setActiveEditor(null)}
                  />
                )}

                {editor.currentService && !editor.activeEditor && (
                  <div className="p-8">
                    <div className="max-w-3xl mx-auto space-y-8">
                      <div className={cn(theme.containers.card)}>
                        <div className={cn(theme.containers.sectionHeader, 'p-6')}>
                          <div>
                            <h3 className={cn('text-lg font-bold', theme.text.strong)}>
                              Container Image
                            </h3>
                            <p className={cn('text-sm mt-1', theme.text.muted)}>
                              Replace the full image reference or update its tag.
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {pendingImageUpdate && (
                              <button
                                onClick={() => editor.clearImageUpdate(editor.currentService!.name)}
                                className={cn(
                                  'text-xs font-medium transition-colors',
                                  theme.text.muted,
                                  'hover:text-zinc-900 dark:hover:text-zinc-100'
                                )}
                              >
                                Discard change
                              </button>
                            )}
                            <button
                              onClick={() => editor.setActiveEditor('image')}
                              className={cn(
                                'px-3 py-1.5 text-xs font-semibold rounded-lg shadow-sm',
                                theme.brand.composePreview
                              )}
                            >
                              Edit image
                            </button>
                          </div>
                        </div>
                        <div className="p-6 space-y-3">
                          <div>
                            <span
                              className={cn(
                                'block text-xs font-bold uppercase tracking-wide',
                                theme.text.muted
                              )}
                            >
                              Current
                            </span>
                            <div
                              className={cn('mt-1 font-mono text-sm break-all', theme.text.strong)}
                            >
                              {editor.currentService.image || 'No image specified'}
                            </div>
                          </div>
                          {updatedImageValue && (
                            <div
                              className={cn(
                                'pt-2 border-t border-dashed',
                                'border-zinc-200 dark:border-zinc-700'
                              )}
                            >
                              <span
                                className={cn(
                                  'block text-xs font-bold uppercase tracking-wide',
                                  theme.text.info
                                )}
                              >
                                Updated
                              </span>
                              <div
                                className={cn('mt-1 font-mono text-sm break-all', theme.text.info)}
                              >
                                {updatedImageValue}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className={cn(theme.containers.card)}>
                        <div className={cn(theme.containers.sectionHeader, 'p-6')}>
                          <div>
                            <h3 className={cn('text-lg font-bold', theme.text.strong)}>Ports</h3>
                            <p className={cn('text-sm mt-1', theme.text.muted)}>
                              Saving replaces the entire <code className="font-mono">ports</code>{' '}
                              list for this service.
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {pendingPortUpdate && (
                              <button
                                onClick={() => editor.clearPortUpdate(editor.currentService!.name)}
                                className={cn(
                                  'text-xs font-medium transition-colors',
                                  theme.text.muted,
                                  'hover:text-zinc-900 dark:hover:text-zinc-100'
                                )}
                              >
                                Discard change
                              </button>
                            )}
                            <button
                              onClick={() => editor.setActiveEditor('ports')}
                              className={cn(
                                'px-3 py-1.5 text-xs font-semibold rounded-lg shadow-sm',
                                theme.brand.composePreview
                              )}
                            >
                              Edit ports
                            </button>
                          </div>
                        </div>
                        <div className="p-6 space-y-4">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <span
                                className={cn(
                                  'text-xs font-bold uppercase tracking-wide',
                                  theme.text.muted
                                )}
                              >
                                Current
                              </span>
                              {portSource === 'runtime' && (
                                <span
                                  className={cn(
                                    'text-xs px-2 py-0.5 rounded',
                                    theme.badges.tag.base,
                                    theme.badges.tag.warning
                                  )}
                                  title="Ports derived from running container (not defined in compose file)"
                                >
                                  Runtime
                                </span>
                              )}
                              {portSource === 'compose' && (
                                <span
                                  className={cn(
                                    'text-xs px-2 py-0.5 rounded',
                                    theme.badges.tag.base,
                                    theme.badges.tag.success
                                  )}
                                  title="Ports defined in compose file"
                                >
                                  Compose
                                </span>
                              )}
                            </div>
                            {displayedCurrentPorts.length > 0 ? (
                              <ul
                                className={cn(
                                  'mt-2 space-y-1 font-mono text-sm',
                                  theme.text.strong
                                )}
                              >
                                {displayedCurrentPorts.map((entry) => (
                                  <li key={entry}>{entry}</li>
                                ))}
                              </ul>
                            ) : (
                              <p className={cn('mt-2 text-sm', theme.text.muted)}>
                                No ports exposed
                              </p>
                            )}
                          </div>
                          {pendingPortUpdate && (
                            <div
                              className={cn(
                                'pt-2 border-t border-dashed',
                                'border-zinc-200 dark:border-zinc-700'
                              )}
                            >
                              <span
                                className={cn(
                                  'block text-xs font-bold uppercase tracking-wide',
                                  theme.text.info
                                )}
                              >
                                Updated
                              </span>
                              {pendingPortUpdate.ports.length > 0 ? (
                                <ul
                                  className={cn(
                                    'mt-2 space-y-1 font-mono text-sm',
                                    theme.text.info
                                  )}
                                >
                                  {pendingPortUpdate.ports.map((entry) => (
                                    <li key={entry}>{entry}</li>
                                  ))}
                                </ul>
                              ) : (
                                <p className={cn('mt-2 text-sm', theme.text.info)}>
                                  Ports will be cleared
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className={cn(theme.containers.card)}>
                        <div className={cn(theme.containers.sectionHeader, 'p-6')}>
                          <div>
                            <h3 className={cn('text-lg font-bold', theme.text.strong)}>
                              Environment Variables
                            </h3>
                            <p className={cn('text-sm mt-1', theme.text.muted)}>
                              Manage environment variables defined in the compose file.
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {pendingEnvironmentUpdate && (
                              <button
                                onClick={() =>
                                  editor.clearEnvironmentUpdate(editor.currentService!.name)
                                }
                                className={cn(
                                  'text-xs font-medium transition-colors',
                                  theme.text.muted,
                                  'hover:text-zinc-900 dark:hover:text-zinc-100'
                                )}
                              >
                                Discard change
                              </button>
                            )}
                            <button
                              onClick={() => editor.setActiveEditor('environment')}
                              className={cn(
                                'px-3 py-1.5 text-xs font-semibold rounded-lg shadow-sm',
                                theme.brand.composePreview
                              )}
                            >
                              Edit environment
                            </button>
                          </div>
                        </div>
                        <div className="p-6 space-y-4">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <span
                                className={cn(
                                  'text-xs font-bold uppercase tracking-wide',
                                  theme.text.muted
                                )}
                              >
                                Current
                              </span>
                              <span
                                className={cn(
                                  'text-xs px-2 py-0.5 rounded',
                                  theme.badges.tag.base,
                                  theme.badges.tag.success
                                )}
                                title="Variables defined in compose file"
                              >
                                Compose
                              </span>
                            </div>
                            {currentEnvironment.length > 0 ? (
                              <div className="mt-2 space-y-2">
                                {currentEnvironment.map((env) => (
                                  <div
                                    key={env.key}
                                    className={cn(theme.surface.soft, 'rounded p-2')}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span
                                        className={cn(
                                          'font-mono text-xs font-semibold',
                                          theme.text.strong
                                        )}
                                      >
                                        {env.key}
                                      </span>
                                      {env.is_sensitive && (
                                        <span
                                          className={cn(
                                            theme.badges.tag.base,
                                            theme.badges.tag.warning
                                          )}
                                        >
                                          Sensitive
                                        </span>
                                      )}
                                    </div>
                                    <p className={cn('mt-1 font-mono text-xs', theme.text.subtle)}>
                                      {env.is_sensitive ? '***' : env.value || '(empty)'}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className={cn('mt-2 text-sm', theme.text.muted)}>
                                No environment variables defined
                              </p>
                            )}
                          </div>
                          {pendingEnvironmentUpdate && (
                            <div
                              className={cn(
                                'pt-2 border-t border-dashed',
                                'border-zinc-200 dark:border-zinc-700'
                              )}
                            >
                              <span
                                className={cn(
                                  'block text-xs font-bold uppercase tracking-wide',
                                  theme.text.info
                                )}
                              >
                                Updated
                              </span>
                              {pendingEnvironmentUpdate.environment.length > 0 ? (
                                <div className={cn('mt-2 space-y-1', theme.text.info)}>
                                  <p className="text-sm">
                                    {pendingEnvironmentUpdate.environment.length} variable
                                    {pendingEnvironmentUpdate.environment.length === 1
                                      ? ''
                                      : 's'}{' '}
                                    defined
                                  </p>
                                </div>
                              ) : (
                                <p className={cn('mt-2 text-sm', theme.text.info)}>
                                  Environment variables will be cleared
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div
              className={cn(
                'border-t px-6 py-4 flex-shrink-0',
                'border-zinc-200 dark:border-zinc-800',
                theme.surface.muted
              )}
            >
              <div className="flex items-center justify-between">
                <div>
                  {editor.hasChanges && (
                    <p
                      className={cn(
                        'text-sm font-semibold flex items-center gap-2',
                        theme.text.warning
                      )}
                    >
                      <div
                        className={cn(
                          'h-2 w-2 rounded-full animate-pulse',
                          theme.badges.dot.warning
                        )}
                      />
                      Unsaved changes
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={onClose}
                    disabled={editor.isSaving}
                    className={cn(theme.buttons.secondary, 'disabled:opacity-50')}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!editor.hasChanges || editor.isSaving || isLoadingPreview}
                    className={cn(
                      'inline-flex items-center gap-2 px-6 py-2.5',
                      theme.brand.composeButton,
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                  >
                    {isLoadingPreview ? (
                      <>
                        <ArrowPathIcon className="h-5 w-5 animate-spin" />
                        Loading preview...
                      </>
                    ) : editor.isSaving ? (
                      <>
                        <ArrowPathIcon className="h-5 w-5 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <CheckIcon className="h-5 w-5" />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showDiffModal && diffData && (
        <ComposeDiffModal
          original={diffData.original}
          preview={diffData.preview}
          onConfirm={handleConfirmSave}
          onCancel={() => setShowDiffModal(false)}
          isLoading={editor.isSaving}
        />
      )}
    </div>
  );
};
