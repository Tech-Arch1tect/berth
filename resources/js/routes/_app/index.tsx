import { createFileRoute } from '@tanstack/react-router';
import Dashboard from '../../features/dashboard/pages/Dashboard';

export const Route = createFileRoute('/_app/')({
  component: Dashboard,
});
