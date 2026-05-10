import { createFileRoute } from '@tanstack/react-router';
import OperationLogs from '../../../features/admin/operation-logs/pages/OperationLogs';

export const Route = createFileRoute('/_app/admin/operation-logs')({
  component: OperationLogs,
});
