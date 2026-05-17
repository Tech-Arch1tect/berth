import { createFileRoute } from '@tanstack/react-router';
import RoleStackPermissions from '../../../features/admin/users/pages/RoleStackPermissions';

export const Route = createFileRoute('/_app/admin/roles_/$roleid/stack-permissions')({
  component: RoleStackPermissions,
});
