import { createFileRoute } from '@tanstack/react-router';
import Maintenance from '../../features/maintenance/pages/Maintenance';

export const Route = createFileRoute('/_app/servers/$serverid/maintenance')({
  component: Maintenance,
});
