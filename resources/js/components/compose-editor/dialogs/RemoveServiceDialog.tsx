import React, { useState, useMemo } from 'react';
import { ExclamationTriangleIcon, TrashIcon } from '@heroicons/react/24/outline';
import { Modal } from '../../common/Modal';
import { LoadingSpinner } from '../../common/LoadingSpinner';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';
import { ComposeServiceConfig } from '../../../types/compose';

interface RemoveServiceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onRemove: (serviceName: string) => Promise<void>;
  serviceName: string;
  services: Record<string, ComposeServiceConfig>;
}

export const RemoveServiceDialog: React.FC<RemoveServiceDialogProps> = ({
  isOpen,
  onClose,
  onRemove,
  serviceName,
  services,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dependentServices = useMemo(() => {
    const dependents: string[] = [];
    for (const [name, config] of Object.entries(services)) {
      if (name === serviceName) continue;
      if (config.depends_on && Object.keys(config.depends_on).includes(serviceName)) {
        dependents.push(name);
      }
    }
    return dependents;
  }, [services, serviceName]);

  const handleRemove = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      await onRemove(serviceName);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove service');
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasDependents = dependentServices.length > 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" size="sm">
      <div className="text-center">
        <ExclamationTriangleIcon className={cn('w-16 h-16 mx-auto mb-4', theme.text.danger)} />
        <h3 className={cn('text-lg font-medium mb-2', theme.text.strong)}>Remove Service</h3>
        <p className={cn('text-sm mb-4', theme.text.muted)}>
          Are you sure you want to remove the service{' '}
          <span className="font-mono font-medium">{serviceName}</span>?
        </p>

        {hasDependents && (
          <div className={cn('text-left p-3 rounded-lg mb-4', 'bg-amber-50 dark:bg-amber-900/20')}>
            <p className={cn('text-sm font-medium mb-2', 'text-amber-700 dark:text-amber-400')}>
              Warning: Other services depend on this service
            </p>
            <ul
              className={cn('text-sm list-disc list-inside', 'text-amber-600 dark:text-amber-500')}
            >
              {dependentServices.map((name) => (
                <li key={name} className="font-mono">
                  {name}
                </li>
              ))}
            </ul>
            <p className={cn('text-xs mt-2', 'text-amber-600 dark:text-amber-500')}>
              These services may fail to start after removing this service.
            </p>
          </div>
        )}

        <p className={cn('text-sm font-medium', theme.text.danger)}>
          This action cannot be undone.
        </p>

        {error && (
          <div
            className={cn(
              'text-sm p-3 rounded-lg mt-4',
              'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400'
            )}
          >
            {error}
          </div>
        )}

        <div className="mt-6 flex space-x-3">
          <button
            onClick={handleRemove}
            disabled={isSubmitting}
            className={cn(
              theme.buttons.danger,
              'flex-1 inline-flex items-center justify-center gap-2',
              isSubmitting && 'opacity-50 cursor-not-allowed'
            )}
          >
            {isSubmitting ? (
              <>
                <LoadingSpinner size="sm" />
                Removing...
              </>
            ) : (
              <>
                <TrashIcon className="w-4 h-4" />
                Remove Service
              </>
            )}
          </button>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className={cn(
              theme.buttons.secondary,
              'flex-1',
              isSubmitting && 'opacity-50 cursor-not-allowed'
            )}
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
};
