import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/servers/$serverid/maintenance')({
  component: () => null,
});
