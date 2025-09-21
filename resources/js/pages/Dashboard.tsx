import Layout from '../components/Layout';
import FlashMessages from '../components/FlashMessages';
import { Head } from '@inertiajs/react';
import { Server } from '../types/server';
import {
  DashboardStats,
  DashboardStatusAlert,
  DashboardServerSection,
  useDashboardHealth,
} from '../components/dashboard';

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

export default function Dashboard({ title, servers, currentUser }: DashboardProps) {
  const userRoles = currentUser?.roles?.map((role) => role.name) || [];
  const healthSummary = useDashboardHealth(servers);

  return (
    <Layout>
      <Head title={title} />

      {/* Header Section */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
              {title}
            </h1>
            <p className="mt-2 text-slate-600 dark:text-slate-400">
              Welcome back,{' '}
              <span className="font-semibold text-slate-900 dark:text-white">
                {currentUser.username}
              </span>
              ! Here's your infrastructure overview.
            </p>
          </div>
          <div className="flex items-center space-x-2 text-sm text-slate-500 dark:text-slate-400">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span>Live data</span>
          </div>
        </div>
      </div>

      <FlashMessages className="mb-8" />

      {/* Status Alert */}
      <DashboardStatusAlert healthSummary={healthSummary} />

      {/* Stats Grid */}
      <DashboardStats healthSummary={healthSummary} userRoles={userRoles} />

      {/* Servers Section */}
      <DashboardServerSection servers={servers} healthSummary={healthSummary} />
    </Layout>
  );
}
