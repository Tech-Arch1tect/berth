import { useState, useEffect, useMemo, useCallback } from 'react';
import { ComposeService } from '../types/stack';
import { ComposeChanges } from '../components/compose';
import { showToast } from '../utils/toast';

export function useComposeEditor(
  services: ComposeService[],
  onUpdate: (changes: ComposeChanges) => Promise<void>
) {
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

  const queueImageUpdate = useCallback(
    (serviceName: string, imageTag?: string, fullImage?: string) => {
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
    },
    []
  );

  const queuePortUpdate = useCallback(
    (serviceName: string, ports: string[]) => {
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
    },
    [services]
  );

  const clearImageUpdate = useCallback((serviceName: string) => {
    setChanges((prev) => {
      const remaining =
        prev.service_image_updates?.filter((entry) => entry.service_name !== serviceName) ?? [];
      return {
        ...prev,
        service_image_updates: remaining.length > 0 ? remaining : undefined,
      };
    });
  }, []);

  const clearPortUpdate = useCallback((serviceName: string) => {
    setChanges((prev) => {
      const remaining =
        prev.service_port_updates?.filter((entry) => entry.service_name !== serviceName) ?? [];
      return {
        ...prev,
        service_port_updates: remaining.length > 0 ? remaining : undefined,
      };
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (!hasChanges) {
      showToast.error('No changes to save');
      return false;
    }

    setIsSaving(true);
    try {
      await onUpdate(changes);
      showToast.success('Compose file updated successfully');
      return true;
    } catch (error: any) {
      showToast.error(error?.message || 'Failed to update compose file');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [hasChanges, changes, onUpdate]);

  return {
    selectedService,
    setSelectedService,
    activeEditor,
    setActiveEditor,
    isSaving,
    currentService,
    hasChanges,
    changes,
    queueImageUpdate,
    queuePortUpdate,
    clearImageUpdate,
    clearPortUpdate,
    handleSave,
  };
}
