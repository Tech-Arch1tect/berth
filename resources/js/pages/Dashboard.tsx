import React, { useState, useCallback, useMemo } from 'react';
import { Head } from '@inertiajs/react';
import { useQueries } from '@tanstack/react-query';
import { Server } from '../types/server';
import { useDashboardHealth, useDashboardActivity } from '../components/dashboard';
import { PanelLayout } from '../components/common/PanelLayout';
import { DashboardSidebar } from '../components/dashboard/sidebar/DashboardSidebar';
import { DashboardPage, SECTION_IDS } from '../components/dashboard/content/DashboardPage';
import { DashboardToolbar } from '../components/dashboard/toolbar/DashboardToolbar';
import { DashboardStatusBar } from '../components/dashboard/statusbar/DashboardStatusBar';
import Layout from '../components/layout/Layout';
import FlashMessages from '../components/FlashMessages';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import {
  getApiV1ServersServeridStatistics,
  getGetApiV1ServersServeridStatisticsQueryKey,
} from '../api/generated/servers/servers';

interface DashboardProps {
  title: string;
  servers: Server[];
  currentUser: {
    id: number;
    username: string;
    email: string;
    roles?: Array<{ name: string }>;
  };
}

type DashboardComponent = React.FC<DashboardProps> & {
  layout?: (page: React.ReactElement) => React.ReactElement;
};

const Dashboard: DashboardComponent = ({ title, servers, currentUser }) => {
  const userRoles = currentUser?.roles?.map((role) => role.name) || [];
  const isAdmin = userRoles.includes('admin');

  const [activeSection, setActiveSection] = useState<string>(SECTION_IDS.overview);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const healthSummary = useDashboardHealth(servers);
  const activitySummary = useDashboardActivity();

  const activeServers = servers.filter((s) => s.is_active);
  const statisticsQueries = useQueries({
    queries: activeServers.map((server) => ({
      queryKey: getGetApiV1ServersServeridStatisticsQueryKey(server.id),
      queryFn: () => getApiV1ServersServeridStatistics(server.id),
      staleTime: 30 * 1000,
      gcTime: 5 * 60 * 1000,
    })),
  });

  const serverStats = useMemo(() => {
    const map = new Map<number, { total: number; healthy: number; unhealthy: number }>();
    activeServers.forEach((server, index) => {
      const query = statisticsQueries[index];
      const stats = query?.data?.data?.statistics;
      if (stats) {
        map.set(server.id, {
          total: stats.total_stacks,
          healthy: stats.healthy_stacks,
          unhealthy: stats.unhealthy_stacks,
        });
      }
    });
    return map;
  }, [activeServers, statisticsQueries]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);

    statisticsQueries.forEach((query) => {
      query.refetch();
    });
    setTimeout(() => {
      setIsRefreshing(false);
      setLastUpdated(new Date());
    }, 500);
  }, [statisticsQueries]);

  const handleSectionChange = useCallback((sectionId: string) => {
    setActiveSection(sectionId);
  }, []);

  const isLoading = statisticsQueries.some((q) => q.isLoading) || healthSummary.serversLoading > 0;

  const isInitialLoad = isLoading && statisticsQueries.every((q) => !q.data);

  if (isInitialLoad) {
    return (
      <>
        <Head title={title} />
        <FlashMessages className="fixed top-4 right-4 z-50" />
        <div className="h-full flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
          <div className="text-center">
            <LoadingSpinner size="lg" />
            <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">Loading dashboard...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head title={title} />
      <FlashMessages className="fixed top-4 right-4 z-50" />

      <div className="h-full flex flex-col">
        <PanelLayout
          storageKey="dashboard"
          sidebarTitle="Servers"
          toolbar={
            <DashboardToolbar
              title={title}
              isRefreshing={isRefreshing}
              onRefresh={handleRefresh}
              isAdmin={isAdmin}
            />
          }
          sidebar={
            <DashboardSidebar
              servers={servers}
              activeSection={activeSection}
              healthSummary={healthSummary}
              serverStats={serverStats}
            />
          }
          content={
            <DashboardPage
              servers={servers}
              healthSummary={healthSummary}
              activitySummary={activitySummary}
              userRoles={userRoles}
              serverStats={serverStats}
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
    </>
  );
};

Dashboard.layout = (page: React.ReactElement) => <Layout>{page}</Layout>;

export default Dashboard;
