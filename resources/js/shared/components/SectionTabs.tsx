import { useEffect, useLayoutEffect, useRef, useState, type FC } from 'react';
import { EllipsisHorizontalIcon } from '@heroicons/react/24/outline';
import { cn } from '../utils/cn';
import type { Tab } from './Tabs';

interface SectionTabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
  'aria-label'?: string;
}

const GAP = 4;
const MORE_RESERVE = 100;

function tabClass(active: boolean, disabled?: boolean) {
  return cn(
    'inline-flex flex-shrink-0 items-center gap-2 whitespace-nowrap',
    'min-h-[44px] border-b-2 -mb-px px-3 text-sm font-medium transition-colors',
    active
      ? 'border-teal-500 text-teal-600 dark:text-teal-400'
      : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100',
    disabled && 'cursor-not-allowed opacity-40 hover:text-zinc-500'
  );
}

const Badge: FC<{ badge: string | number; active: boolean }> = ({ badge, active }) => (
  <span
    className={cn(
      'ml-0.5 rounded-full px-1.5 py-0.5 text-xs',
      active
        ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300'
        : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300'
    )}
  >
    {badge}
  </span>
);

export const SectionTabs: FC<SectionTabsProps> = ({
  tabs,
  activeTab,
  onTabChange,
  className,
  'aria-label': ariaLabel,
}) => {
  const shown = tabs.filter((tab) => !tab.hidden);

  const rowRef = useRef<HTMLDivElement>(null);
  const measureRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(shown.length);
  const [menuOpen, setMenuOpen] = useState(false);

  const tabsKey = shown
    .map((tab) => `${tab.id}:${tab.label}:${tab.badge ?? ''}:${tab.disabled ?? ''}`)
    .join('|');

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;

    const compute = () => {
      const available = row.clientWidth;
      const widths = shown.map((_, i) => measureRefs.current[i]?.offsetWidth ?? 0);

      let total = 0;
      widths.forEach((w, i) => {
        total += w + (i > 0 ? GAP : 0);
      });
      if (total <= available) {
        setVisibleCount(shown.length);
        return;
      }

      let used = MORE_RESERVE;
      let count = 0;
      for (let i = 0; i < widths.length; i++) {
        const add = widths[i] + (i > 0 ? GAP : 0);
        if (used + add <= available) {
          used += add;
          count += 1;
        } else {
          break;
        }
      }
      setVisibleCount(Math.max(count, 1));
    };

    compute();
    const observer = new ResizeObserver(compute);
    observer.observe(row);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabsKey]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || moreButtonRef.current?.contains(target)) return;
      setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [menuOpen]);

  const visible = shown.slice(0, visibleCount);
  const overflow = shown.slice(visibleCount);
  const activeInOverflow = overflow.some((tab) => tab.id === activeTab);

  return (
    <div className={cn('relative border-b border-zinc-200 dark:border-zinc-800 px-2', className)}>
      <div
        aria-hidden
        className="pointer-events-none invisible absolute left-0 top-0 flex items-center gap-x-1"
      >
        {shown.map((tab, i) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              tabIndex={-1}
              ref={(el) => {
                measureRefs.current[i] = el;
              }}
              className={tabClass(false)}
            >
              {Icon && <Icon className="h-4 w-4" />}
              <span>{tab.label}</span>
              {tab.badge !== undefined && <Badge badge={tab.badge} active={false} />}
            </button>
          );
        })}
      </div>

      <div
        ref={rowRef}
        role="tablist"
        aria-label={ariaLabel}
        className="flex items-center gap-x-1 overflow-hidden"
      >
        {visible.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              disabled={tab.disabled}
              onClick={() => {
                if (tab.disabled) return;
                setMenuOpen(false);
                onTabChange(tab.id);
              }}
              className={tabClass(active, tab.disabled)}
            >
              {Icon && <Icon className="h-4 w-4" />}
              <span>{tab.label}</span>
              {tab.badge !== undefined && <Badge badge={tab.badge} active={active} />}
            </button>
          );
        })}

        {overflow.length > 0 && (
          <button
            ref={moreButtonRef}
            type="button"
            aria-label="More sections"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className={cn(tabClass(activeInOverflow), 'flex-shrink-0')}
          >
            <EllipsisHorizontalIcon className="h-5 w-5" />
            <span>More</span>
          </button>
        )}
      </div>

      {menuOpen && overflow.length > 0 && (
        <div
          ref={menuRef}
          role="menu"
          className="absolute right-2 top-full z-20 mt-1 min-w-[12rem] rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          {overflow.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="menuitem"
                disabled={tab.disabled}
                onClick={() => {
                  if (tab.disabled) return;
                  onTabChange(tab.id);
                  setMenuOpen(false);
                }}
                className={cn(
                  'flex min-h-[44px] w-full items-center gap-2 px-3 py-2 text-left text-sm',
                  active ? 'text-teal-600 dark:text-teal-400' : 'text-zinc-700 dark:text-zinc-200',
                  'hover:bg-zinc-100 dark:hover:bg-zinc-800',
                  tab.disabled && 'cursor-not-allowed opacity-40'
                )}
              >
                {Icon && <Icon className="h-4 w-4 flex-shrink-0" />}
                <span className="flex-1">{tab.label}</span>
                {tab.badge !== undefined && <Badge badge={tab.badge} active={active} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
