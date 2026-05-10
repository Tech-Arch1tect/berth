import { createFileRoute } from '@tanstack/react-router';
import AdminUsers from '../../../features/admin/users/pages/Users';

export const Route = createFileRoute('/_app/admin/users')({
  component: AdminUsers,
});
