import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Terminal } from './Terminal';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';

interface TerminalModalProps {
  isOpen: boolean;
  onClose: () => void;
  serverid: number;
  stackname: string;
  serviceName: string;
  containerName?: string;
}

export const TerminalModal: React.FC<TerminalModalProps> = ({
  isOpen,
  onClose,
  serverid,
  stackname,
  serviceName,
  containerName,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className={theme.modal.overlay}>
      <div className="absolute inset-0 bg-black bg-opacity-75" />
      <div className="relative flex items-center justify-center min-h-screen p-4">
        <div
          ref={modalRef}
          className="relative w-full max-w-6xl h-[80vh] bg-slate-900 rounded-lg shadow-2xl"
        >
          <div className="flex items-center justify-between px-6 py-4 bg-slate-800 rounded-t-lg border-b border-slate-700">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full" />
              <div className="w-3 h-3 bg-yellow-500 rounded-full" />
              <div className="w-3 h-3 bg-green-500 rounded-full" />
              <span className={cn('ml-4 text-sm font-medium', theme.text.standard)}>
                Terminal - {stackname}/{serviceName}
                {containerName && <span className={theme.text.muted}>:{containerName}</span>}
              </span>
            </div>
            <button
              onClick={onClose}
              className={cn(
                'p-1 rounded-md transition-colors',
                theme.text.muted,
                'hover:' + theme.text.standard,
                'hover:bg-slate-700'
              )}
              aria-label="Close terminal"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          <div className="h-[calc(100%-4rem)]">
            <Terminal
              serverid={serverid}
              stackname={stackname}
              serviceName={serviceName}
              containerName={containerName}
              className="h-full rounded-none rounded-b-lg"
            />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
