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
    <div className={cn(theme.cards.enhanced.base, theme.cards.enhanced.hover, 'h-full')}>
      <div className={theme.brand.gradientAccent} />

      <div className="p-5">
        <div className="flex items-center space-x-3 mb-5">
          <div className={theme.icon.gradientMd}>
            <DocumentTextIcon className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h2 className={cn('text-base font-bold', theme.text.strong)}>Stack Info</h2>
            <p className={cn('text-xs', theme.text.subtle)}>Configuration</p>
          </div>
        </div>

        <dl className="space-y-4">
          <div className="space-y-2">
            <dt className={cn('text-xs font-semibold uppercase tracking-wide', theme.text.subtle)}>
              Compose File
            </dt>
            <dd
              className={cn(
                'text-xs font-mono px-3 py-2 rounded-lg border',
                theme.surface.subtle,
                theme.intent.neutral.border,
                theme.text.strong,
                'break-all leading-relaxed'
              )}
            >
              {composeFile}
            </dd>
          </div>
          <div className="space-y-2">
            <dt className={cn('text-xs font-semibold uppercase tracking-wide', theme.text.subtle)}>
              Stack Path
            </dt>
            <dd
              className={cn(
                'text-xs font-mono px-3 py-2 rounded-lg border',
                theme.surface.subtle,
                theme.intent.neutral.border,
                theme.text.strong,
                'break-all leading-relaxed'
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
