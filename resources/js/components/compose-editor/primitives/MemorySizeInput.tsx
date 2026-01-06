import React, { useState, useMemo, useCallback } from 'react';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';

interface MemorySizeInputProps {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  disabled?: boolean;
  placeholder?: string;
  label?: string;
}

const UNITS = ['b', 'k', 'm', 'g'] as const;
const UNIT_LABELS: Record<string, string> = {
  b: 'B',
  k: 'KB',
  m: 'MB',
  g: 'GB',
};

function parseMemorySize(size: string): { value: number | null; unit: string | null } {
  if (!size) return { value: null, unit: null };

  const match = size.toLowerCase().match(/^(\d+\.?\d*)(b|k|kb|m|mb|g|gb)?$/);
  if (match) {
    let unit = match[2] || 'b';
    if (unit === 'kb') unit = 'k';
    if (unit === 'mb') unit = 'm';
    if (unit === 'gb') unit = 'g';
    return {
      value: parseFloat(match[1]),
      unit,
    };
  }

  return { value: null, unit: null };
}

export const MemorySizeInput: React.FC<MemorySizeInputProps> = ({
  value,
  onChange,
  disabled,
  placeholder = '0',
  label,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [localNumValue, setLocalNumValue] = useState<string>('');
  const [localUnit, setLocalUnit] = useState<string>('m');

  const { displayNum, displayUnit } = useMemo(() => {
    if (isEditing) {
      return { displayNum: localNumValue, displayUnit: localUnit };
    }
    const parsed = parseMemorySize(value || '');
    return {
      displayNum: parsed.value?.toString() || '',
      displayUnit: parsed.unit || 'm',
    };
  }, [value, isEditing, localNumValue, localUnit]);

  const handleNumChange = useCallback(
    (newNum: string) => {
      setLocalNumValue(newNum);
      if (newNum === '' || newNum === '0') {
        onChange(undefined);
      } else {
        const num = parseFloat(newNum);
        if (!isNaN(num) && num >= 0) {
          onChange(`${num}${isEditing ? localUnit : displayUnit}`);
        }
      }
    },
    [onChange, isEditing, localUnit, displayUnit]
  );

  const handleUnitChange = useCallback(
    (newUnit: string) => {
      setLocalUnit(newUnit);
      const currentNum = isEditing ? localNumValue : displayNum;
      if (currentNum && currentNum !== '0') {
        const num = parseFloat(currentNum);
        if (!isNaN(num) && num >= 0) {
          onChange(`${num}${newUnit}`);
        }
      }
    },
    [onChange, isEditing, localNumValue, displayNum]
  );

  const handleFocus = useCallback(() => {
    const parsed = parseMemorySize(value || '');
    setLocalNumValue(parsed.value?.toString() || '');
    setLocalUnit(parsed.unit || 'm');
    setIsEditing(true);
  }, [value]);

  const handleBlur = useCallback(() => {
    setIsEditing(false);
  }, []);

  return (
    <div className="flex flex-col gap-1">
      {label && <label className={cn('text-xs', theme.text.subtle)}>{label}</label>}
      <div className="flex">
        <input
          type="number"
          value={displayNum}
          onChange={(e) => handleNumChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
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
          value={displayUnit}
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
          {UNITS.map((u) => (
            <option key={u} value={u}>
              {UNIT_LABELS[u]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
