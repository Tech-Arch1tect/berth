import { useState, useCallback } from 'react';
import { useDashboardActivity } from '../components';
import { useDashboardStatistics } from '../hooks/useDashboardStatistics';
import { PanelLayout } from '../../../shared/components/PanelLayout';
import { DashboardSidebar } from '../components/sidebar/DashboardSidebar';
import { DashboardPage, SECTION_IDS } from '../components/content/DashboardPage';
import { DashboardToolbar } from '../components/toolbar/DashboardToolbar';
import { DashboardStatusBar } from '../components/statusbar/DashboardStatusBar';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner';
import { useAuth } from '../../../shared/auth/auth-context';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { useGetApiV1Servers } from '../../../api/generated/servers/servers';

export default function Dashboard() {
  useDocumentTitle('Dashboard');
  const { user } = useAuth();
  const { data: serversResponse, isLoading: serversLoading } = useGetApiV1Servers();
  const servers = serversResponse?.data?.servers ?? [];

  const userRoles = user?.roles?.map((role) => role.name) ?? [];
  const isAdmin = userRoles.includes('admin');

  const [activeSection, setActiveSection] = useState<string>(SECTION_IDS.attention);
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
    <div className="h-full flex flex-col">
      <PanelLayout
        storageKey="dashboard"
        sidebarTitle="Servers"
        toolbar={
          <DashboardToolbar
            title="Dashboard"
            isRefreshing={isRefreshing}
            onRefresh={handleRefresh}
            isAdmin={isAdmin}
          />
        }
        sidebar={<DashboardSidebar activeSection={activeSection} healthSummary={healthSummary} />}
        content={
          <DashboardPage
            servers={servers}
            activitySummary={activitySummary}
            serverStats={serverStats}
            serverStatus={serverStatus}
            onSectionChange={handleSectionChange}
          />
        }
        statusBar={
          <DashboardStatusBar
            healthSummary={healthSummary}
            lastUpdated={lastUpdated}
            isLoading={isLoading}
          />
        }
      />
    </div>
  );
}
