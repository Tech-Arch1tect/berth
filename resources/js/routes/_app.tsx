import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import Layout from '../shared/layout/Layout';
import { LoadingSpinner } from '../shared/components/LoadingSpinner';
import { useAuth } from '../shared/auth/auth-context';

function AppShell() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !user) {
      void navigate({ to: '/auth/login' });
    }
  }, [isLoading, user, navigate]);

  if (isLoading || !user) {
    return <LoadingSpinner size="lg" fullScreen text="Loading..." />;
  }

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

export const Route = createFileRoute('/_app')({
  component: AppShell,
});
