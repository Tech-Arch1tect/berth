import { createFileRoute } from '@tanstack/react-router';
import UserRoles from '../../../features/admin/users/pages/UserRoles';

export const Route = createFileRoute('/_app/admin/users_/$userid/roles')({
  component: UserRoles,
});
