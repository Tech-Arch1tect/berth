import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';

interface CreateStackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (name: string) => Promise<void>;
}

const STACK_NAME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;
const MAX_STACK_NAME_LENGTH = 64;

export const CreateStackModal: React.FC<CreateStackModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setError(null);
      setLoading(false);
    }
  }, [isOpen]);

  const validateName = (value: string): string | null => {
    if (!value) {
      return 'Stack name is required';
    }
    if (value.length > MAX_STACK_NAME_LENGTH) {
      return `Stack name must be ${MAX_STACK_NAME_LENGTH} characters or less`;
    }
    if (!STACK_NAME_REGEX.test(value)) {
      return 'Stack name must start with a letter or number and can only contain letters, numbers, dots, underscores, and hyphens';
    }
    if (value.includes('..')) {
      return 'Stack name cannot contain ".."';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validateName(name);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onConfirm(name);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create stack');
    } finally {
      setLoading(false);
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setName(value);

    if (error) {
      setError(null);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Stack"
      subtitle="Create a new Docker Compose stack with a template configuration"
      size="sm"
      footer={
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className={cn(theme.buttons.secondary)}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="create-stack-form"
            disabled={loading || !name.trim()}
            className={cn(theme.buttons.primary, loading && 'opacity-50 cursor-wait')}
          >
            {loading ? 'Creating...' : 'Create Stack'}
          </button>
        </div>
      }
    >
      <form id="create-stack-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="stack-name"
            className={cn('block text-sm font-medium mb-1.5', theme.text.strong)}
          >
            Stack Name
          </label>
          <input
            id="stack-name"
            type="text"
            value={name}
            onChange={handleNameChange}
            placeholder="my-app"
            autoFocus
            disabled={loading}
            className={cn(
              theme.forms.input,
              error && 'border-red-500 dark:border-red-500 focus:border-red-500'
            )}
          />
          <p className={cn('mt-1.5 text-xs', theme.text.muted)}>
            Use lowercase letters, numbers, dots, underscores, and hyphens. Must start with a letter
            or number.
          </p>
        </div>

        {error && (
          <div
            className={cn(
              'px-3 py-2 rounded-lg text-sm',
              'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800'
            )}
          >
            {error}
          </div>
        )}

        <div
          className={cn(
            'px-3 py-2 rounded-lg text-sm',
            'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
          )}
        >
          A minimal docker-compose.yml will be created. You can then configure it using the Compose
          Editor.
        </div>
      </form>
    </Modal>
  );
};
