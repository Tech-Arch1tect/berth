import React, { useEffect, useMemo, useState } from 'react';
import { ComposeService } from '../../types/stack';
import { ServiceImageEditor } from './ServiceImageEditor';
import { ServicePortsEditor, derivePortsFromService } from './ServicePortsEditor';
import { XMarkIcon, CheckIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
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
}

interface ComposeEditorProps {
  services: ComposeService[];
  serverid: number;
  stackname: string;
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
  const [selectedService, setSelectedService] = useState<string | null>(services[0]?.name ?? null);
  const [activeEditor, setActiveEditor] = useState<'image' | 'ports' | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [changes, setChanges] = useState<ComposeChanges>({});

  useEffect(() => {
    if (!services.length) {
      setSelectedService(null);
      return;
    }

    if (!selectedService || !services.some((service) => service.name === selectedService)) {
      setSelectedService(services[0].name);
      return;
    }
  }, [services, selectedService]);

  useEffect(() => {
    setActiveEditor(null);
  }, [selectedService]);

  const currentService = useMemo(
    () => services.find((service) => service.name === selectedService) ?? null,
    [services, selectedService]
  );

  const hasChanges = useMemo(() => {
    const imageCount = changes.service_image_updates?.length ?? 0;
    const portCount = changes.service_port_updates?.length ?? 0;
    return imageCount + portCount > 0;
  }, [changes]);

  const queueImageUpdate = (serviceName: string, imageTag?: string, fullImage?: string) => {
    const update = {
      service_name: serviceName,
      ...(imageTag ? { new_tag: imageTag } : {}),
      ...(fullImage ? { new_image: fullImage } : {}),
    };

    setChanges((prev) => {
      const remaining =
        prev.service_image_updates?.filter((entry) => entry.service_name !== serviceName) ?? [];
      const next: ComposeChanges = {
        ...prev,
        service_image_updates: [...remaining, update],
      };
      return next;
    });
  };

  const queuePortUpdate = (serviceName: string, ports: string[]) => {
    const normalized = ports.map((entry) => entry.trim()).filter((entry) => entry.length > 0);
    const baselineService = services.find((service) => service.name === serviceName);
    const baseline =
      baselineService?.ports?.map((entry) => entry.trim()).filter((entry) => entry.length > 0) ??
      [];

    const isUnchanged =
      normalized.length === baseline.length &&
      normalized.every((entry, index) => entry === baseline[index]);
    if (isUnchanged) {
      clearPortUpdate(serviceName);
      return;
    }

    const update = { service_name: serviceName, ports: normalized };
    setChanges((prev) => {
      const remaining =
        prev.service_port_updates?.filter((entry) => entry.service_name !== serviceName) ?? [];
      const nextUpdates =
        normalized.length === 0
          ? [...remaining, { service_name: serviceName, ports: [] }]
          : [...remaining, update];
      return {
        ...prev,
        service_port_updates: nextUpdates.length > 0 ? nextUpdates : undefined,
      };
    });
  };

  const clearImageUpdate = (serviceName: string) => {
    setChanges((prev) => {
      const remaining =
        prev.service_image_updates?.filter((entry) => entry.service_name !== serviceName) ?? [];
      return {
        ...prev,
        service_image_updates: remaining.length > 0 ? remaining : undefined,
      };
    });
  };

  const clearPortUpdate = (serviceName: string) => {
    setChanges((prev) => {
      const remaining =
        prev.service_port_updates?.filter((entry) => entry.service_name !== serviceName) ?? [];
      return {
        ...prev,
        service_port_updates: remaining.length > 0 ? remaining : undefined,
      };
    });
  };

  const handleSave = async () => {
    if (!hasChanges) {
      showToast.error('No changes to save');
      return;
    }

    setIsSaving(true);
    try {
      await onUpdate(changes);
      showToast.success('Compose file updated successfully');
      onClose();
    } catch (error: any) {
      showToast.error(error?.message || 'Failed to update compose file');
    } finally {
      setIsSaving(false);
    }
  };

  const pendingImageUpdate = currentService
    ? changes.service_image_updates?.find((entry) => entry.service_name === currentService.name)
    : undefined;

  const pendingPortUpdate = currentService
    ? changes.service_port_updates?.find((entry) => entry.service_name === currentService.name)
    : undefined;

  const currentDefinedPorts = currentService?.ports ?? [];

  const runtimePorts = useMemo(() => {
    if (!currentService) {
      return [];
    }
    return derivePortsFromService(currentService);
  }, [currentService]);

  const displayedCurrentPorts = currentDefinedPorts.length > 0 ? currentDefinedPorts : runtimePorts;

  const updatedImageValue = currentService
    ? buildUpdatedImageValue(currentService, pendingImageUpdate)
    : null;

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-gray-900/75 dark:bg-gray-950/90 transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-6xl h-[90vh] max-h-[900px]">
        <div className="pointer-events-auto w-full h-full">
          <div className="flex h-full flex-col bg-white dark:bg-gray-900 shadow-2xl rounded-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white">Compose Editor</h2>
                  <p className="mt-1 text-sm text-indigo-100">
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
              <div className="w-64 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 overflow-y-auto">
                <div className="p-4">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3">
                    Services
                  </h3>
                  <div className="space-y-1">
                    {services.map((service) => (
                      <button
                        key={service.name}
                        onClick={() => setSelectedService(service.name)}
                        className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 ${
                          selectedService === service.name
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{service.name}</span>
                          {serviceHasPendingChanges(changes, service.name) && (
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
                {!currentService && (
                  <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
                    No service selected
                  </div>
                )}

                {currentService && activeEditor === 'image' && (
                  <ServiceImageEditor
                    service={currentService}
                    onUpdate={queueImageUpdate}
                    onBack={() => setActiveEditor(null)}
                  />
                )}

                {currentService && activeEditor === 'ports' && (
                  <ServicePortsEditor
                    service={currentService}
                    pendingPorts={pendingPortUpdate?.ports}
                    onApply={queuePortUpdate}
                    onCancel={() => setActiveEditor(null)}
                  />
                )}

                {currentService && !activeEditor && (
                  <div className="p-8">
                    <div className="max-w-3xl mx-auto space-y-8">
                      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
                        <div className="flex items-start justify-between p-6 border-b border-gray-100 dark:border-gray-800">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                              Container Image
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Replace the full image reference or update its tag.
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {pendingImageUpdate && (
                              <button
                                onClick={() => clearImageUpdate(currentService.name)}
                                className="text-xs font-medium text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                              >
                                Discard change
                              </button>
                            )}
                            <button
                              onClick={() => setActiveEditor('image')}
                              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-200 dark:hover:bg-indigo-900/60"
                            >
                              Edit image
                            </button>
                          </div>
                        </div>
                        <div className="p-6 space-y-3">
                          <div>
                            <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                              Current
                            </span>
                            <div className="mt-1 font-mono text-sm text-gray-900 dark:text-white break-all">
                              {currentService.image || 'No image specified'}
                            </div>
                          </div>
                          {updatedImageValue && (
                            <div className="pt-2 border-t border-dashed border-gray-200 dark:border-gray-700">
                              <span className="block text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">
                                Updated
                              </span>
                              <div className="mt-1 font-mono text-sm text-indigo-700 dark:text-indigo-200 break-all">
                                {updatedImageValue}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
                        <div className="flex items-start justify-between p-6 border-b border-gray-100 dark:border-gray-800">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                              Ports
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Saving replaces the entire <code className="font-mono">ports</code>{' '}
                              list for this service.
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {pendingPortUpdate && (
                              <button
                                onClick={() => clearPortUpdate(currentService.name)}
                                className="text-xs font-medium text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                              >
                                Discard change
                              </button>
                            )}
                            <button
                              onClick={() => setActiveEditor('ports')}
                              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-200 dark:hover:bg-indigo-900/60"
                            >
                              Edit ports
                            </button>
                          </div>
                        </div>
                        <div className="p-6 space-y-4">
                          <div>
                            <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                              Current
                            </span>
                            {displayedCurrentPorts.length > 0 ? (
                              <ul className="mt-2 space-y-1 font-mono text-sm text-gray-900 dark:text-white">
                                {displayedCurrentPorts.map((entry) => (
                                  <li key={entry}>{entry}</li>
                                ))}
                              </ul>
                            ) : (
                              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                                No ports exposed
                              </p>
                            )}
                          </div>
                          {pendingPortUpdate && (
                            <div className="pt-2 border-t border-dashed border-gray-200 dark:border-gray-700">
                              <span className="block text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">
                                Updated
                              </span>
                              {pendingPortUpdate.ports.length > 0 ? (
                                <ul className="mt-2 space-y-1 font-mono text-sm text-indigo-700 dark:text-indigo-200">
                                  {pendingPortUpdate.ports.map((entry) => (
                                    <li key={entry}>{entry}</li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="mt-2 text-sm text-indigo-700 dark:text-indigo-200">
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

            <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-6 py-4 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  {hasChanges && (
                    <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                      Unsaved changes
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={onClose}
                    disabled={isSaving}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!hasChanges || isSaving}
                    className="inline-flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? (
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
