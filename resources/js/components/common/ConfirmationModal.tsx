import React from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Modal } from './Modal';
import { LoadingSpinner } from './LoadingSpinner';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';

export interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
  showWarning?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'warning',
  isLoading = false,
  showWarning = true,
}) => {
  const iconClasses = {
    danger: theme.text.danger,
    warning: theme.text.warning,
    info: theme.text.info,
  };

  const buttonClasses = {
    danger: theme.buttons.danger,
    warning: theme.buttons.warning,
    info: theme.buttons.info,
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" size="sm">
      <div className="text-center">
        <ExclamationTriangleIcon className={cn('w-16 h-16 mx-auto mb-4', iconClasses[variant])} />
        <h3 className={cn('text-lg font-medium mb-2', theme.text.strong)}>{title}</h3>
        <p className={cn('text-sm mb-2', theme.text.muted)}>{message}</p>
        {showWarning && variant === 'danger' && (
          <p className={cn('text-sm mt-2 font-medium', theme.text.danger)}>
            This action cannot be undone.
          </p>
        )}

        <div className="mt-6 flex space-x-3">
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={cn(
              buttonClasses[variant],
              'flex-1',
              isLoading && 'opacity-50 cursor-not-allowed'
            )}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <LoadingSpinner size="sm" />
                Processing...
              </span>
            ) : (
              confirmText
            )}
          </button>
          <button
            onClick={onClose}
            disabled={isLoading}
            className={cn(
              theme.buttons.secondary,
              'flex-1',
              isLoading && 'opacity-50 cursor-not-allowed'
            )}
          >
            {cancelText}
          </button>
        </div>
      </div>
    </Modal>
  );
};
