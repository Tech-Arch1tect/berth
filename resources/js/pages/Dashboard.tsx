import React, { useState, useCallback, useMemo } from 'react';
import { Head } from '@inertiajs/react';
import { useQueries } from '@tanstack/react-query';
import { Server } from '../types/server';
import { StackStatistics } from '../types/server';
import { useDashboardHealth, useDashboardActivity } from '../components/dashboard';
import { DashboardLayout } from '../components/dashboard/layout/DashboardLayout';
import { DashboardSidebar } from '../components/dashboard/sidebar/DashboardSidebar';
import { DashboardPage, SECTION_IDS } from '../components/dashboard/content/DashboardPage';
import { DashboardToolbar } from '../components/dashboard/toolbar/DashboardToolbar';
import { DashboardStatusBar } from '../components/dashboard/statusbar/DashboardStatusBar';
import { FullWidthLayout } from '../components/layout/Layout';
import FlashMessages from '../components/FlashMessages';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

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

interface ServerStatisticsResponse {
  statistics: StackStatistics;
}

const fetchServerStatistics = async (serverId: number): Promise<StackStatistics> => {
  const response = await fetch(`/api/servers/${serverId}/statistics`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch server statistics');
  }

  const data: ServerStatisticsResponse = await response.json();
  return data.statistics;
};

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
      queryKey: ['server-statistics', server.id],
      queryFn: () => fetchServerStatistics(server.id),
      staleTime: 30 * 1000,
      gcTime: 5 * 60 * 1000,
    })),
  });

  const serverStats = useMemo(() => {
    const map = new Map<number, { total: number; healthy: number; unhealthy: number }>();
    activeServers.forEach((server, index) => {
      const query = statisticsQueries[index];
      if (query?.data) {
        map.set(server.id, {
          total: query.data.total_stacks,
          healthy: query.data.healthy_stacks,
          unhealthy: query.data.unhealthy_stacks,
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
        <DashboardLayout
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

Dashboard.layout = (page: React.ReactElement) => <FullWidthLayout>{page}</FullWidthLayout>;

export default Dashboard;
