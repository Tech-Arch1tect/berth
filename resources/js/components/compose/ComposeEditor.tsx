import React, { useMemo } from 'react';
import { ComposeService } from '../../types/stack';
import { ServiceImageEditor } from './ServiceImageEditor';
import { ServicePortsEditor, derivePortsFromService } from './ServicePortsEditor';
import { XMarkIcon, CheckIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { useComposeEditor } from '../../hooks/useComposeEditor';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';

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
}

interface ComposeEditorProps {
  services: ComposeService[];
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
  return Boolean(imageChange || portChange);
};

export const ComposeEditor: React.FC<ComposeEditorProps> = ({ services, onUpdate, onClose }) => {
  const editor = useComposeEditor(services, onUpdate);

  const handleSave = async () => {
    const success = await editor.handleSave();
    if (success) {
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

  const currentDefinedPorts = editor.currentService?.ports ?? [];

  const runtimePorts = useMemo(() => {
    if (!editor.currentService) {
      return [];
    }
    return derivePortsFromService(editor.currentService);
  }, [editor.currentService]);

  const displayedCurrentPorts = currentDefinedPorts.length > 0 ? currentDefinedPorts : runtimePorts;

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
                            <span
                              className={cn(
                                'block text-xs font-bold uppercase tracking-wide',
                                theme.text.muted
                              )}
                            >
                              Current
                            </span>
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
                    disabled={!editor.hasChanges || editor.isSaving}
                    className={cn(
                      'inline-flex items-center gap-2 px-6 py-2.5',
                      theme.brand.composeButton,
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                  >
                    {editor.isSaving ? (
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
    </div>
  );
};
