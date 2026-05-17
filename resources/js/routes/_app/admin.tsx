import { createFileRoute, Outlet } from '@tanstack/react-router';
import GenericError from '../../shared/errors/pages/Generic';
import { useAuth } from '../../shared/auth/auth-context';
import { userIsAdmin } from '../../shared/auth/roles';

function AdminShell() {
  const { user } = useAuth();
  if (!userIsAdmin(user)) {
    return <GenericError code={403} message="Insufficient permissions" />;
  }
  return <Outlet />;
}

export const Route = createFileRoute('/_app/admin')({
  component: AdminShell,
});
