import React from 'react';
import { cn } from '../../../../shared/utils/cn';
import { HealthSummary } from '../../types';
import { SECTION_IDS } from '../content/DashboardPage';
import { ServerIcon, ClockIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface DashboardSidebarProps {
  activeSection: string;
  healthSummary: HealthSummary;
}

interface NavItemProps {
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
  badge?: React.ReactNode;
}

const NavItem: React.FC<NavItemProps> = ({ label, icon, isActive, onClick, badge }) => (
  <button
    onClick={onClick}
    className={cn(
      'w-full flex items-center gap-2 px-3 py-1.5 text-left',
      'hover:bg-zinc-100 dark:hover:bg-zinc-800',
      'transition-colors',
      isActive && 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300'
    )}
  >
    <span className="w-4 h-4 flex-shrink-0 text-zinc-500 dark:text-zinc-400">{icon}</span>
    <span className="flex-1 text-sm">{label}</span>
    {badge}
  </button>
);

const scrollToSection = (sectionId: string) => {
  const element = document.getElementById(sectionId);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });

    element.classList.add('animate-highlight-flash');

    const handleAnimationEnd = () => {
      element.classList.remove('animate-highlight-flash');
      element.removeEventListener('animationend', handleAnimationEnd);
    };
    element.addEventListener('animationend', handleAnimationEnd);
  }
};

export const DashboardSidebar: React.FC<DashboardSidebarProps> = ({
  activeSection,
  healthSummary,
}) => {
  const attentionCount = healthSummary.serversWithErrors + healthSummary.unhealthyStacks;

  return (
    <div className="py-1 px-1">
      <NavItem
        label="Needs attention"
        icon={<ExclamationTriangleIcon className="w-4 h-4" />}
        isActive={activeSection === SECTION_IDS.attention}
        onClick={() => scrollToSection(SECTION_IDS.attention)}
        badge={
          attentionCount > 0 ? (
            <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
              {attentionCount}
            </span>
          ) : null
        }
      />
      <NavItem
        label="Servers"
        icon={<ServerIcon className="w-4 h-4" />}
        isActive={activeSection === SECTION_IDS.servers}
        onClick={() => scrollToSection(SECTION_IDS.servers)}
      />
      <NavItem
        label="Activity"
        icon={<ClockIcon className="w-4 h-4" />}
        isActive={activeSection === SECTION_IDS.activity}
        onClick={() => scrollToSection(SECTION_IDS.activity)}
      />
    </div>
  );
};
