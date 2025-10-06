import React, { useState } from 'react';
import { ComposeService } from '../../types/stack';
import { ServiceImageEditor } from './ServiceImageEditor';
import { XMarkIcon, CheckIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { showToast } from '../../utils/toast';

export interface ComposeChanges {
  service_image_updates?: Array<{
    service_name: string;
    new_image?: string;
    new_tag?: string;
  }>;
}

interface ComposeEditorProps {
  services: ComposeService[];
  serverid: number;
  stackname: string;
  onUpdate: (changes: ComposeChanges) => Promise<void>;
  onClose: () => void;
}

export const ComposeEditor: React.FC<ComposeEditorProps> = ({
  services,
  serverid,
  stackname,
  onUpdate,
  onClose,
}) => {
  const [selectedService, setSelectedService] = useState<string | null>(services[0]?.name || null);
  const [activeEditor, setActiveEditor] = useState<'image' | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [changes, setChanges] = useState<ComposeChanges>({});

  const currentService = services.find((s) => s.name === selectedService);

  const hasChanges = () => {
    return (changes.service_image_updates?.length || 0) > 0;
  };

  const handleImageUpdate = (serviceName: string, imageTag?: string, fullImage?: string) => {
    const update = {
      service_name: serviceName,
      ...(imageTag && { new_tag: imageTag }),
      ...(fullImage && { new_image: fullImage }),
    };

    setChanges((prev) => {
      const existing = prev.service_image_updates || [];
      const filtered = existing.filter((u) => u.service_name !== serviceName);
      return {
        ...prev,
        service_image_updates: [...filtered, update],
      };
    });
  };

  const handleSave = async () => {
    if (!hasChanges()) {
      showToast.error('No changes to save');
      return;
    }

    setIsSaving(true);
    try {
      await onUpdate(changes);
      showToast.success('Compose file updated successfully');
      onClose();
    } catch (error: any) {
      showToast.error(error.message || 'Failed to update compose file');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-gray-900/75 dark:bg-gray-950/90 transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-6xl h-[90vh] max-h-[900px]">
        <div className="pointer-events-auto w-full h-full">
          <div className="flex h-full flex-col bg-white dark:bg-gray-900 shadow-2xl rounded-2xl overflow-hidden">
            {/* Header */}
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

            {/* Main Content */}
            <div className="flex flex-1 overflow-hidden">
              {/* Service Selector Sidebar */}
              <div className="w-64 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 overflow-y-auto">
                <div className="p-4">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3">
                    Services
                  </h3>
                  <div className="space-y-1">
                    {services.map((service) => (
                      <button
                        key={service.name}
                        onClick={() => {
                          setSelectedService(service.name);
                          setActiveEditor(null);
                        }}
                        className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 ${
                          selectedService === service.name
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{service.name}</span>
                          {changes.service_image_updates?.some(
                            (u) => u.service_name === service.name
                          ) && <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />}
                        </div>
                        {service.image && (
                          <div className="text-xs mt-1 opacity-75 truncate">{service.image}</div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Editor Panel */}
              <div className="flex-1 overflow-y-auto">
                {!activeEditor && currentService && (
                  <div className="p-8">
                    <div className="max-w-2xl mx-auto">
                      <div className="text-center mb-8">
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                          {currentService.name}
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400">
                          Select what you'd like to edit
                        </p>
                      </div>

                      <ServiceImageEditor
                        service={currentService}
                        onUpdate={handleImageUpdate}
                        onBack={() => setSelectedService(null)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-6 py-4 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  {hasChanges() && (
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
                    disabled={!hasChanges() || isSaving}
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
