import React, { useState, useRef, useEffect } from 'react';
import {
  XMarkIcon,
  MinusCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';
import { StorageManager } from '../../utils/storage';

interface NegativeFiltersProps {
  filters: string[];
  onFiltersChange: (filters: string[]) => void;
  placeholder?: string;
  isExpanded: boolean;
  onToggle: () => void;
}

export const NegativeFilters: React.FC<NegativeFiltersProps> = ({
  filters,
  onFiltersChange,
  placeholder = 'Exclude stacks containing...',
  isExpanded,
  onToggle,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHistory(StorageManager.negativeFilters.getHistory());
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addFilter = (filter: string) => {
    const trimmed = filter.trim().toLowerCase();
    if (!trimmed) return;
    if (filters.includes(trimmed)) return;

    const newFilters = [...filters, trimmed];
    onFiltersChange(newFilters);

    StorageManager.negativeFilters.addToHistory(trimmed);
    setHistory(StorageManager.negativeFilters.getHistory());

    setInputValue('');
    setShowSuggestions(false);
  };

  const removeFilter = (filter: string) => {
    const newFilters = filters.filter((f) => f !== filter);
    onFiltersChange(newFilters);
  };

  const clearAllFilters = () => {
    onFiltersChange([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addFilter(inputValue);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setShowSuggestions(true);
  };

  const handleInputFocus = () => {
    if (history.length > 0) {
      setShowSuggestions(true);
    }
  };

  const selectSuggestion = (suggestion: string) => {
    addFilter(suggestion);
  };

  const suggestions = history
    .filter((h) => !filters.includes(h))
    .filter((h) => h.toLowerCase().includes(inputValue.toLowerCase()))
    .slice(0, 5);

  if (!isExpanded) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div ref={containerRef} className="relative">
        <MinusCircleIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleInputFocus}
          placeholder={placeholder}
          className={cn(
            'w-full pl-10 pr-4 py-2.5 rounded-xl transition-all duration-200',
            theme.forms.input
          )}
        />

        {showSuggestions && suggestions.length > 0 && (
          <div
            className={cn(
              'absolute z-10 w-full mt-1 rounded-xl border shadow-lg overflow-hidden',
              theme.cards.translucent
            )}
          >
            <div className="py-1">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => selectSuggestion(suggestion)}
                  className={cn(
                    'w-full px-4 py-2 text-left text-sm transition-colors',
                    'hover:bg-zinc-100 dark:hover:bg-zinc-800',
                    theme.text.strong
                  )}
                >
                  <div className="flex items-center gap-2">
                    <MinusCircleIcon className="h-3.5 w-3.5 text-slate-400" />
                    <span className="font-mono text-xs">{suggestion}</span>
                  </div>
                </button>
              ))}
            </div>
            <div
              className={cn(
                'px-3 py-2 text-xs border-t border-zinc-200 dark:border-zinc-800',
                theme.text.subtle
              )}
            >
              Press Enter to exclude
            </div>
          </div>
        )}
      </div>

      {filters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.map((filter, index) => (
            <div
              key={index}
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg',
                'bg-zinc-100 dark:bg-zinc-800',
                'border border-zinc-200 dark:border-zinc-700',
                theme.text.muted,
                'text-xs'
              )}
            >
              <span className="font-mono">{filter}</span>
              <button
                onClick={() => removeFilter(filter)}
                className={cn(
                  'hover:bg-zinc-200 dark:hover:bg-zinc-600 rounded p-0.5 transition-colors'
                )}
                title="Remove exclusion"
              >
                <XMarkIcon className="h-3 w-3" />
              </button>
            </div>
          ))}
          {filters.length > 1 && (
            <button
              onClick={clearAllFilters}
              className={cn(
                'text-xs px-2.5 py-1 rounded-lg',
                'hover:bg-zinc-200 dark:hover:bg-zinc-700',
                'border border-zinc-200 dark:border-zinc-700',
                theme.text.muted
              )}
            >
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
};
