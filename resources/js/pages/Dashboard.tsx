import Layout from '../components/Layout';
import FlashMessages from '../components/FlashMessages';
import ServerList from '../components/ServerList';
import { Head } from '@inertiajs/react';
import { Server } from '../types/server';

interface DashboardProps {
  title: string;
  servers: Server[];
  currentUser: {
    id: number;
    username: string;
    email: string;
  };
}

export default function Dashboard({ title, servers, currentUser }: DashboardProps) {
  return (
    <Layout>
      <Head title={title} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-8">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{title}</h1>
            <p className="text-gray-600 dark:text-gray-300">
              Welcome back, <span className="font-semibold">{currentUser.username}</span>!
            </p>
          </div>

          <FlashMessages className="mb-6" />

          <div className="grid gap-6 mb-8">
            <ServerList servers={servers} />
          </div>
        </div>
      </div>
    </Layout>
  );
}
