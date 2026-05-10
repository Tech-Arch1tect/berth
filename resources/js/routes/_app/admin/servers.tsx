import { createFileRoute } from '@tanstack/react-router';
import AdminServers from '../../../features/admin/servers/pages/Servers';

export const Route = createFileRoute('/_app/admin/servers')({
  component: AdminServers,
});
