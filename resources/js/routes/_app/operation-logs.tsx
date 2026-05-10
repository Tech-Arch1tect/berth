import { createFileRoute } from '@tanstack/react-router';
import OperationLogs from '../../features/operation-logs/pages/OperationLogs';

export const Route = createFileRoute('/_app/operation-logs')({
  component: OperationLogs,
});
