import React from 'react';
import { Link } from '@inertiajs/react';
import { HomeIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  homeHref?: string;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ items, homeHref = '/' }) => {
  return (
    <nav className="flex mb-6" aria-label="Breadcrumb">
      <ol className="flex items-center space-x-4">
        {/* Home */}
        <li>
          <Link
            href={homeHref}
            className={cn(
              theme.text.subtle,
              'hover:text-slate-700 dark:hover:text-slate-300 transition-colors'
            )}
          >
            <HomeIcon className="h-5 w-5" />
          </Link>
        </li>

        {/* Breadcrumb items */}
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const Icon = item.icon;

          return (
            <li key={index}>
              <div className="flex items-center">
                <ChevronRightIcon className={cn('h-5 w-5', theme.text.subtle)} />
                {item.href && !isLast ? (
                  <Link
                    href={item.href}
                    className={cn(
                      'ml-4 text-sm font-medium transition-colors',
                      theme.text.muted,
                      'hover:text-slate-700 dark:hover:text-slate-300'
                    )}
                  >
                    {Icon && <Icon className="inline h-4 w-4 mr-1" />}
                    {item.label}
                  </Link>
                ) : (
                  <span
                    className={cn(
                      'ml-4 text-sm font-medium',
                      isLast ? theme.text.strong : theme.text.muted
                    )}
                  >
                    {Icon && <Icon className="inline h-4 w-4 mr-1" />}
                    {item.label}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
