import React from 'react';
import { ImageHistoryLayer as ImageHistoryLayerType } from '../../../types/stack';
import {
  formatImageSize,
  formatCreatedTime,
  parseDockerfileCommand,
  getCommandType,
  getCommandColor,
} from './utils/image-helpers';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';

interface ImageHistoryLayerProps {
  layer: ImageHistoryLayerType;
}

export const ImageHistoryLayer: React.FC<ImageHistoryLayerProps> = ({ layer }) => {
  const command = parseDockerfileCommand(layer.created_by);
  const commandType = getCommandType(command);
  const colorClass = getCommandColor(commandType);

  return (
    <div className="flex items-start space-x-3 py-2 px-3 rounded-lg transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
      <div className="flex-shrink-0 mt-0.5">
        <div className={cn('w-2 h-2 rounded-full', theme.surface.muted)} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <code className={`text-sm font-mono leading-relaxed ${colorClass}`}>{command}</code>

            {layer.comment && (
              <p className={cn('text-xs mt-1 italic', theme.text.subtle)}>{layer.comment}</p>
            )}
          </div>

          <div className="flex-shrink-0 ml-4 text-right">
            <div className={cn('text-xs', theme.text.subtle)}>{formatImageSize(layer.size)}</div>
            <div className={cn('text-xs', theme.text.subtle)}>
              {formatCreatedTime(layer.created)}
            </div>
          </div>
        </div>

        {layer.tags && layer.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {layer.tags.map((tag, index) => (
              <span key={index} className={cn(theme.badges.tag.base, theme.badges.tag.info)}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
