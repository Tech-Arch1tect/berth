import { createFileRoute } from '@tanstack/react-router';
import StackDetails from '../../features/stacks/pages/StackDetails';

export const Route = createFileRoute('/_app/servers/$serverid/stacks/$stackname')({
  component: StackDetails,
});
