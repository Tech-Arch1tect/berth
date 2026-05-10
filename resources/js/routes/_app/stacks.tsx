import { createFileRoute } from '@tanstack/react-router';
import Stacks from '../../features/stacks/pages/Stacks';

export const Route = createFileRoute('/_app/stacks')({
  component: Stacks,
});
