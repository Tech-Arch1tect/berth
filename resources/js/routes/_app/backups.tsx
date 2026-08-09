import { createFileRoute } from '@tanstack/react-router';
import BackupsOverview from '../../features/backups/pages/BackupsOverview';

export const Route = createFileRoute('/_app/backups')({
  component: BackupsOverview,
});
