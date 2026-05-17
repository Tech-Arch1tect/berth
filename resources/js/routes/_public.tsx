import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { LoadingSpinner } from '../shared/components/LoadingSpinner';
import { useAuth } from '../shared/auth/auth-context';

function PublicShell() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && user) {
      void navigate({ to: '/' });
    }
  }, [isLoading, user, navigate]);

  if (isLoading || user) {
    return <LoadingSpinner size="lg" fullScreen text="Loading..." />;
  }

  return <Outlet />;
}

export const Route = createFileRoute('/_public')({
  component: PublicShell,
});
