import type { ImageHistoryLayer as ImageHistoryLayerType } from '../../../api/generated/models';
import {
  formatImageSize,
  formatCreatedTime,
  parseDockerfileCommand,
  getCommandType,
} from './utils/image-helpers';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';

interface ImageHistoryLayerProps {
  layer: ImageHistoryLayerType;
}

export const ImageHistoryLayer: React.FC<ImageHistoryLayerProps> = ({ layer }) => {
  const command = parseDockerfileCommand(layer.created_by);
  const commandType = getCommandType(command);
  const commandBody = command.replace(/^[A-Z]+\s*/, '');

  if (!command || command === '#(nop)') {
    return null;
  }

  return (
    <div
      className={cn(
        'py-2.5 px-3 rounded-lg',
        'border-l-2 border-zinc-200 dark:border-zinc-700',
        'hover:bg-zinc-100 dark:hover:bg-zinc-800/50',
        'transition-colors'
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {commandType !== 'UNKNOWN' && (
              <span
                className={cn(
                  'px-1.5 py-0.5 rounded text-xs font-medium',
                  'bg-zinc-200 dark:bg-zinc-700',
                  'text-zinc-600 dark:text-zinc-300'
                )}
              >
                {commandType}
              </span>
            )}
            {layer.size > 0 && (
              <span className={cn('text-xs', theme.text.subtle)}>
                {formatImageSize(layer.size)}
              </span>
            )}
          </div>

          <code
            className={cn(
              'text-xs font-mono leading-relaxed block break-all',
              'text-zinc-700 dark:text-zinc-300'
            )}
          >
            {commandBody || command}
          </code>

          {layer.comment && (
            <p className={cn('text-xs mt-1.5 italic', theme.text.subtle)}>{layer.comment}</p>
          )}
        </div>

        <div className="flex-shrink-0 text-right">
          <span className={cn('text-xs', theme.text.subtle)}>
            {formatCreatedTime(layer.created)}
          </span>
        </div>
      </div>
    </div>
  );
};
