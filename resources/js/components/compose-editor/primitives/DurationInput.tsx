import React, { useState, useEffect } from 'react';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';

interface DurationInputProps {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  disabled?: boolean;
  placeholder?: string;
  label?: string;
  allowedUnits?: ('ns' | 'us' | 'ms' | 's' | 'm' | 'h')[];
}

const UNIT_LABELS: Record<string, string> = {
  ns: 'ns',
  us: 'µs',
  ms: 'ms',
  s: 'sec',
  m: 'min',
  h: 'hr',
};

const DEFAULT_UNITS: ('ns' | 'us' | 'ms' | 's' | 'm' | 'h')[] = ['ms', 's', 'm', 'h'];

export const DurationInput: React.FC<DurationInputProps> = ({
  value,
  onChange,
  disabled,
  placeholder = '0',
  label,
  allowedUnits = DEFAULT_UNITS,
}) => {
  const parsed = parseDuration(value || '');
  const [numValue, setNumValue] = useState<string>(parsed.value?.toString() || '');
  const [unit, setUnit] = useState<string>(
    parsed.unit || allowedUnits[allowedUnits.length > 2 ? 1 : 0]
  );

  useEffect(() => {
    const parsed = parseDuration(value || '');
    if (parsed.value !== null) {
      setNumValue(parsed.value.toString());
      if (parsed.unit && allowedUnits.includes(parsed.unit as (typeof allowedUnits)[number])) {
        setUnit(parsed.unit);
      }
    } else if (!value) {
      setNumValue('');
    }
  }, [value, allowedUnits]);

  const handleNumChange = (newNum: string) => {
    setNumValue(newNum);
    if (newNum === '' || newNum === '0') {
      onChange(undefined);
    } else {
      const num = parseFloat(newNum);
      if (!isNaN(num) && num >= 0) {
        onChange(`${num}${unit}`);
      }
    }
  };

  const handleUnitChange = (newUnit: string) => {
    setUnit(newUnit);
    if (numValue && numValue !== '0') {
      const num = parseFloat(numValue);
      if (!isNaN(num) && num >= 0) {
        onChange(`${num}${newUnit}`);
      }
    }
  };

  return (
    <div className="flex flex-col gap-1">
      {label && <label className={cn('text-xs', theme.text.subtle)}>{label}</label>}
      <div className="flex">
        <input
          type="number"
          value={numValue}
          onChange={(e) => handleNumChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          min={0}
          step="any"
          className={cn(
            'w-20 px-2 py-1.5 text-sm rounded-l border-y border-l',
            'bg-white text-zinc-900 placeholder:text-zinc-400',
            'dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-500',
            'border-zinc-200 dark:border-zinc-700',
            'focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus:z-10',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        />
        <select
          value={unit}
          onChange={(e) => handleUnitChange(e.target.value)}
          disabled={disabled}
          className={cn(
            'px-2 py-1.5 text-sm rounded-r border',
            'bg-zinc-50 text-zinc-900',
            'dark:bg-zinc-800 dark:text-white',
            'border-zinc-200 dark:border-zinc-700',
            'focus:border-teal-500 focus:ring-1 focus:ring-teal-500',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            '-ml-px'
          )}
        >
          {allowedUnits.map((u) => (
            <option key={u} value={u}>
              {UNIT_LABELS[u]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

function parseDuration(duration: string): { value: number | null; unit: string | null } {
  if (!duration) return { value: null, unit: null };

  const match = duration.match(/^(\d+\.?\d*)(ns|us|µs|ms|s|m|h)$/);
  if (match) {
    return {
      value: parseFloat(match[1]),
      unit: match[2] === 'µs' ? 'us' : match[2],
    };
  }

  const num = parseFloat(duration);
  if (!isNaN(num)) {
    return { value: num, unit: 's' };
  }

  return { value: null, unit: null };
}
