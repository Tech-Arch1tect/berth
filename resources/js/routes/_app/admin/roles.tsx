import { createFileRoute } from '@tanstack/react-router';
import AdminRoles from '../../../features/admin/users/pages/Roles';

export const Route = createFileRoute('/_app/admin/roles')({
  component: AdminRoles,
});
