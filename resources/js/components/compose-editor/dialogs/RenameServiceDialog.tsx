import React, { useState, useMemo } from 'react';
import { PencilIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import { Modal } from '../../common/Modal';
import { LoadingSpinner } from '../../common/LoadingSpinner';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';
import { ComposeServiceConfig } from '../../../types/compose';

interface RenameServiceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onRename: (oldName: string, newName: string) => Promise<void>;
  serviceName: string;
  services: Record<string, ComposeServiceConfig>;
}

export const RenameServiceDialog: React.FC<RenameServiceDialogProps> = ({
  isOpen,
  onClose,
  onRename,
  serviceName,
  services,
}) => {
  const [newName, setNewName] = useState(serviceName);
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

  const existingServices = Object.keys(services).filter((n) => n !== serviceName);

  const validate = (): boolean => {
    setError(null);

    if (!newName.trim()) {
      setError('Service name is required');
      return false;
    }

    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(newName)) {
      setError(
        'Service name must start with a letter and contain only letters, numbers, hyphens, and underscores'
      );
      return false;
    }

    if (newName === serviceName) {
      setError('New name must be different from the current name');
      return false;
    }

    if (existingServices.includes(newName)) {
      setError('A service with this name already exists');
      return false;
    }

    return true;
  };

  const handleRename = async () => {
    if (!validate()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await onRename(serviceName, newName.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename service');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setNewName(serviceName);
    setError(null);
    onClose();
  };

  React.useEffect(() => {
    if (isOpen) {
      setNewName(serviceName);
      setError(null);
    }
  }, [isOpen, serviceName]);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Rename Service" size="sm">
      <div className="space-y-4">
        <div className="flex items-center justify-center gap-3 py-2">
          <span
            className={cn(
              'font-mono text-sm px-2 py-1 rounded',
              'bg-zinc-100 dark:bg-zinc-800',
              theme.text.standard
            )}
          >
            {serviceName}
          </span>
          <ArrowRightIcon className={cn('w-4 h-4', theme.text.muted)} />
          <span
            className={cn(
              'font-mono text-sm px-2 py-1 rounded',
              'bg-teal-100 dark:bg-teal-900/30',
              'text-teal-700 dark:text-teal-400'
            )}
          >
            {newName || '?'}
          </span>
        </div>

        <div>
          <label className={cn('block text-sm font-medium mb-2', theme.text.standard)}>
            New Service Name
          </label>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="my-service"
            autoFocus
            className={cn(
              'w-full px-3 py-2 text-sm rounded-lg border font-mono',
              'bg-white text-zinc-900 placeholder:text-zinc-400',
              'dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-500',
              'border-zinc-200 dark:border-zinc-700',
              'focus:border-teal-500 focus:ring-1 focus:ring-teal-500'
            )}
          />
          <p className={cn('text-xs mt-1', theme.text.subtle)}>
            Must start with a letter. Can contain letters, numbers, hyphens, and underscores.
          </p>
        </div>

        {dependentServices.length > 0 && (
          <div className={cn('text-left p-3 rounded-lg', 'bg-blue-50 dark:bg-blue-900/20')}>
            <p className={cn('text-sm font-medium mb-2', 'text-blue-700 dark:text-blue-400')}>
              References will be updated automatically
            </p>
            <p className={cn('text-xs', 'text-blue-600 dark:text-blue-500')}>
              The following services have dependencies on{' '}
              <span className="font-mono">{serviceName}</span> and will be updated:
            </p>
            <ul
              className={cn(
                'text-xs list-disc list-inside mt-1',
                'text-blue-600 dark:text-blue-500'
              )}
            >
              {dependentServices.map((name) => (
                <li key={name} className="font-mono">
                  {name}
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && (
          <div
            className={cn(
              'text-sm p-3 rounded-lg',
              'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400'
            )}
          >
            {error}
          </div>
        )}

        <div className="flex space-x-3 pt-2">
          <button
            onClick={handleRename}
            disabled={isSubmitting}
            className={cn(
              theme.buttons.primary,
              'flex-1 inline-flex items-center justify-center gap-2',
              isSubmitting && 'opacity-50 cursor-not-allowed'
            )}
          >
            {isSubmitting ? (
              <>
                <LoadingSpinner size="sm" />
                Renaming...
              </>
            ) : (
              <>
                <PencilIcon className="w-4 h-4" />
                Rename Service
              </>
            )}
          </button>
          <button
            onClick={handleClose}
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
