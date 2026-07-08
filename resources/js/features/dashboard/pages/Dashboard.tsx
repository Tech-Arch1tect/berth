import { useState, useCallback } from 'react';
import { ExclamationTriangleIcon, ServerIcon, ClockIcon } from '@heroicons/react/24/outline';
import { useDashboardActivity } from '../components';
import { useDashboardStatistics } from '../hooks/useDashboardStatistics';
import { SectionTabs } from '../../../shared/components/SectionTabs';
import type { Tab } from '../../../shared/components/Tabs';
import { DashboardPage, SECTION_IDS } from '../components/content/DashboardPage';
import { DashboardToolbar } from '../components/toolbar/DashboardToolbar';
import { DashboardStatusBar } from '../components/statusbar/DashboardStatusBar';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner';
import { useAuth } from '../../../shared/auth/auth-context';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { useGetApiV1Servers } from '../../../api/generated/servers/servers';

function scrollToSection(sectionId: string) {
  const element = document.getElementById(sectionId);
  if (!element) return;
  element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  element.classList.add('animate-highlight-flash');
  const handleAnimationEnd = () => {
    element.classList.remove('animate-highlight-flash');
    element.removeEventListener('animationend', handleAnimationEnd);
  };
  element.addEventListener('animationend', handleAnimationEnd);
}

export default function Dashboard() {
  useDocumentTitle('Dashboard');
  const { user } = useAuth();
  const { data: serversResponse, isLoading: serversLoading } = useGetApiV1Servers();
  const servers = serversResponse?.data?.servers ?? [];

  const userRoles = user?.roles?.map((role) => role.name) ?? [];
  const isAdmin = userRoles.includes('admin');

  const [activeSection, setActiveSection] = useState<string>(SECTION_IDS.servers);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const {
    serverStats,
    serverStatus,
    healthSummary,
    isLoading: statisticsLoading,
    refetch: refetchStatistics,
  } = useDashboardStatistics(servers);
  const activitySummary = useDashboardActivity();

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);

    refetchStatistics();
    setTimeout(() => {
      setIsRefreshing(false);
      setLastUpdated(new Date());
    }, 500);
  }, [refetchStatistics]);

  const handleSectionChange = useCallback((sectionId: string) => {
    setActiveSection(sectionId);
  }, []);

  const isLoading = serversLoading || statisticsLoading;

  const attentionCount = healthSummary.serversWithErrors + healthSummary.unhealthyStacks;
  const sectionTabs: Tab[] = [
    { id: SECTION_IDS.servers, label: 'Servers', icon: ServerIcon },
    {
      id: SECTION_IDS.attention,
      label: 'Needs attention',
      icon: ExclamationTriangleIcon,
      badge: attentionCount > 0 ? attentionCount : undefined,
    },
    { id: SECTION_IDS.activity, label: 'Activity', icon: ClockIcon },
  ];

  if (serversLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 border-b border-zinc-200 dark:border-zinc-800">
        <DashboardToolbar
          title="Dashboard"
          isRefreshing={isRefreshing}
          onRefresh={handleRefresh}
          isAdmin={isAdmin}
        />
      </div>

      <SectionTabs
        tabs={sectionTabs}
        activeTab={activeSection}
        onTabChange={scrollToSection}
        aria-label="Dashboard sections"
      />

      <div className="flex-1 min-h-0 overflow-auto bg-white dark:bg-zinc-900">
        <DashboardPage
          servers={servers}
          activitySummary={activitySummary}
          serverStats={serverStats}
          serverStatus={serverStatus}
          onSectionChange={handleSectionChange}
        />
      </div>

      <div className="flex-shrink-0 border-t border-zinc-200 dark:border-zinc-800">
        <DashboardStatusBar
          healthSummary={healthSummary}
          lastUpdated={lastUpdated}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
