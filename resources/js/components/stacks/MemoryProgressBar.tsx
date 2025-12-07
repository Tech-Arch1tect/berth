import { useState } from 'react';
import { cn } from '../../utils/cn';
import { formatBytes } from '../../utils/formatters';

type Severity = 'neutral' | 'success' | 'info' | 'warning' | 'danger';

const resolveSeverity = (value?: number): Severity => {
  if (value === undefined || value < 0) return 'neutral';
  if (value >= 90) return 'danger';
  if (value >= 70) return 'warning';
  if (value >= 50) return 'info';
  return 'success';
};

const severityColors: Record<Severity, string> = {
  neutral: 'bg-zinc-300 dark:bg-zinc-600',
  success: 'bg-emerald-500',
  info: 'bg-blue-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
};

interface MemoryProgressBarProps {
  rssPercent: number;
  cachePercent: number;
  rssBytes?: number;
  cacheBytes?: number;
  limitBytes?: number;
  className?: string;
}

export const MemoryProgressBar: React.FC<MemoryProgressBarProps> = ({
  rssPercent,
  cachePercent,
  rssBytes,
  cacheBytes,
  limitBytes,
  className,
}) => {
  const [hoveredSegment, setHoveredSegment] = useState<'rss' | 'cache' | null>(null);

  const rssSeverity = resolveSeverity(rssPercent);
  const rssWidth = Math.min(Math.max(rssPercent, 0), 100);
  const cacheWidth = Math.min(Math.max(cachePercent, 0), 100 - rssWidth);

  const formatPercent = (value: number): string => `${value.toFixed(1)}%`;

  const rssTooltip =
    rssBytes !== undefined
      ? `RSS: ${formatBytes(rssBytes)} (${formatPercent(rssPercent)})`
      : `RSS: ${formatPercent(rssPercent)}`;

  const cacheTooltip =
    cacheBytes !== undefined
      ? `Cache: ${formatBytes(cacheBytes)} (${formatPercent(cachePercent)})`
      : `Cache: ${formatPercent(cachePercent)}`;

  const totalTooltip =
    limitBytes !== undefined && rssBytes !== undefined && cacheBytes !== undefined
      ? `RSS: ${formatBytes(rssBytes)} (${formatPercent(rssPercent)})\nCache: ${formatBytes(cacheBytes)} (${formatPercent(cachePercent)})\nTotal: ${formatBytes(rssBytes + cacheBytes)} / ${formatBytes(limitBytes)}`
      : undefined;

  return (
    <div
      className={cn(
        'relative h-1.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-700 group cursor-help',
        className
      )}
      title={totalTooltip}
    >
      <div className="flex h-full">
        {/* RSS */}
        {rssWidth > 0 && (
          <div
            className={cn(
              'h-full transition-all duration-300 relative',
              rssWidth > 0 && 'rounded-l-full',
              (rssWidth >= 100 || cacheWidth === 0) && 'rounded-r-full',
              severityColors[rssSeverity],
              hoveredSegment === 'rss' && 'ring-2 ring-offset-1 ring-current opacity-90'
            )}
            style={{ width: `${rssWidth}%` }}
            onMouseEnter={() => setHoveredSegment('rss')}
            onMouseLeave={() => setHoveredSegment(null)}
            title={rssTooltip}
          />
        )}
        {/* Cache */}
        {cacheWidth > 0 && (
          <div
            className={cn(
              'h-full transition-all duration-300 relative rounded-r-full',
              rssWidth === 0 && 'rounded-l-full',
              'bg-violet-400 dark:bg-violet-500',
              hoveredSegment === 'cache' && 'ring-2 ring-offset-1 ring-violet-400 opacity-90'
            )}
            style={{ width: `${cacheWidth}%` }}
            onMouseEnter={() => setHoveredSegment('cache')}
            onMouseLeave={() => setHoveredSegment(null)}
            title={cacheTooltip}
          />
        )}
      </div>

      {/* Hover state indicator for empty bar */}
      {rssWidth === 0 && cacheWidth === 0 && (
        <div className="absolute inset-0" title="No memory usage reported" />
      )}
    </div>
  );
};

export default MemoryProgressBar;
