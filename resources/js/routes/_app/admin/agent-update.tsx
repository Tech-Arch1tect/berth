import { createFileRoute } from '@tanstack/react-router';
import AgentUpdate from '../../../features/admin/agent-update/pages/AgentUpdate';

export const Route = createFileRoute('/_app/admin/agent-update')({
  component: AgentUpdate,
});
