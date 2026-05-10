import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/servers/$serverid/registries')({
  component: () => null,
});
