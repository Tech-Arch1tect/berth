import { createFileRoute } from '@tanstack/react-router';
import SecurityAuditLogs from '../../../features/admin/security-audit-logs/pages/SecurityAuditLogs';

export const Route = createFileRoute('/_app/admin/security-audit-logs')({
  component: SecurityAuditLogs,
});
