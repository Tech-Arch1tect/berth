import React, { useState, useEffect } from 'react';
import {
  XMarkIcon,
  InformationCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';
import { ImageUpdate } from '../../types/image-update';
import { ImageUpdateTable } from './ImageUpdateTable';

interface ImageUpdateBannerProps {
  updates: ImageUpdate[];
  stackName: string;
  serverName: string;
  lastChecked: string | null;
  className?: string;
}

export const ImageUpdateBanner: React.FC<ImageUpdateBannerProps> = ({
  updates,
  stackName,
  serverName,
  lastChecked,
  className,
}) => {
  const [isDismissed, setIsDismissed] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Use localStorage to persist dismissal per stack
  const dismissKey = `image-update-banner-${stackName}`;

  useEffect(() => {
    const dismissed = localStorage.getItem(dismissKey);
    if (dismissed === 'true') {
      setIsDismissed(true);
    }
  }, [dismissKey]);

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem(dismissKey, 'true');
  };

  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  if (isDismissed || updates.length === 0) {
    return null;
  }

  const successfulUpdates = updates.filter((u) => !u.check_error && u.update_available);
  const updateCount = successfulUpdates.length;
  const containerCount = new Set(successfulUpdates.map((u) => u.container_name)).size;
  const errorCount = updates.filter((u) => u.check_error).length;

  return (
    <div
      className={cn(
        'rounded-xl border p-4',
        theme.intent.info.border,
        theme.intent.info.surface,
        className
      )}
    >
      <div className="flex items-start gap-3">
        <InformationCircleIcon
          className={cn('h-5 w-5 flex-shrink-0 mt-0.5', theme.intent.info.textStrong)}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className={cn('text-sm font-medium', theme.intent.info.textStrong)}>
                {updateCount > 0 ? (
                  <>
                    {updateCount} container image update{updateCount !== 1 ? 's' : ''} available
                  </>
                ) : (
                  <>Image update check results</>
                )}
              </p>
              <p className={cn('mt-1 text-xs', theme.intent.info.textMuted)}>
                {updateCount > 0 && (
                  <>
                    {containerCount} container{containerCount !== 1 ? 's' : ''} in this stack{' '}
                    {containerCount !== 1 ? 'have' : 'has'} newer images available.
                  </>
                )}
                {errorCount > 0 && (
                  <>
                    {updateCount > 0 && ' '}
                    {errorCount} check{errorCount !== 1 ? 's' : ''} failed.
                  </>
                )}
                {lastChecked && <> Last checked {new Date(lastChecked).toLocaleString()}.</>}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleExpand}
                className={cn(
                  'flex items-center gap-1 text-xs font-medium transition-colors',
                  theme.intent.info.textStrong,
                  'hover:opacity-75'
                )}
              >
                {isExpanded ? (
                  <>
                    Hide details <ChevronUpIcon className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    Show details <ChevronDownIcon className="h-4 w-4" />
                  </>
                )}
              </button>
              <button
                onClick={handleDismiss}
                className={cn(
                  'p-1 rounded transition-colors',
                  theme.intent.info.textMuted,
                  'hover:bg-black/5 dark:hover:bg-white/5'
                )}
                title="Dismiss"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          </div>

          {isExpanded && (
            <div className="mt-4">
              <ImageUpdateTable updates={updates} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
