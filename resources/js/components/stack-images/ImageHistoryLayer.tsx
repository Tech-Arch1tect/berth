import React from 'react';
import { ImageHistoryLayer as ImageHistoryLayerType } from '../../types/stack';
import {
  formatImageSize,
  formatCreatedTime,
  parseDockerfileCommand,
  getCommandType,
  getCommandColor,
} from './utils/image-helpers';

interface ImageHistoryLayerProps {
  layer: ImageHistoryLayerType;
}

export const ImageHistoryLayer: React.FC<ImageHistoryLayerProps> = ({ layer }) => {
  const command = parseDockerfileCommand(layer.created_by);
  const commandType = getCommandType(command);
  const colorClass = getCommandColor(commandType);

  return (
    <div className="flex items-start space-x-3 py-2 px-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg transition-colors">
      <div className="flex-shrink-0 mt-0.5">
        <div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <code className={`text-sm font-mono leading-relaxed ${colorClass}`}>{command}</code>

            {layer.comment && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 italic">
                {layer.comment}
              </p>
            )}
          </div>

          <div className="flex-shrink-0 ml-4 text-right">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {formatImageSize(layer.size)}
            </div>
            <div className="text-xs text-slate-400 dark:text-slate-500">
              {formatCreatedTime(layer.created)}
            </div>
          </div>
        </div>

        {layer.tags && layer.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {layer.tags.map((tag, index) => (
              <span
                key={index}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
