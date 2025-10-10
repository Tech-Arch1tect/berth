import React from 'react';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';
import { DocumentTextIcon } from '@heroicons/react/24/outline';

interface StackInfoCardProps {
  composeFile: string;
  stackPath: string;
}

export const StackInfoCard: React.FC<StackInfoCardProps> = ({ composeFile, stackPath }) => {
  return (
    <div className={cn(theme.containers.cardSoft, 'rounded-2xl overflow-hidden')}>
      <div className={cn(theme.containers.sectionHeader, 'px-6 py-4')}>
        <div className="flex items-center space-x-3">
          <div
            className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center',
              theme.brand.accent
            )}
          >
            <DocumentTextIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className={cn('text-lg font-semibold', theme.text.strong)}>Stack Information</h2>
            <p className={cn('text-sm', theme.text.muted)}>Configuration and metadata</p>
          </div>
        </div>
      </div>
      <div className="p-6">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="flex flex-col space-y-1">
            <dt className={cn('text-sm font-medium', theme.text.muted)}>Compose File</dt>
            <dd
              className={cn(
                'text-sm font-mono px-3 py-2 rounded-lg',
                theme.surface.code,
                theme.text.strong
              )}
            >
              {composeFile}
            </dd>
          </div>
          <div className="flex flex-col space-y-1">
            <dt className={cn('text-sm font-medium', theme.text.muted)}>Stack Path</dt>
            <dd
              className={cn(
                'text-sm font-mono px-3 py-2 rounded-lg',
                theme.surface.code,
                theme.text.strong
              )}
            >
              {stackPath}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
};
