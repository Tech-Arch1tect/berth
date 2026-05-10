import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/api-keys/$keyid/scopes')({
  component: () => null,
});
