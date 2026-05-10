import { createFileRoute } from '@tanstack/react-router';
import Migration from '../../../features/admin/dataexport/pages/Migration';

export const Route = createFileRoute('/_app/admin/migration')({
  component: Migration,
});
