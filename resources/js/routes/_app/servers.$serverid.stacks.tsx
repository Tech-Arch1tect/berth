import { createFileRoute } from '@tanstack/react-router';
import ServerStacks from '../../features/stacks/pages/ServerStacks';

export const Route = createFileRoute('/_app/servers/$serverid/stacks')({
  component: ServerStacks,
});
