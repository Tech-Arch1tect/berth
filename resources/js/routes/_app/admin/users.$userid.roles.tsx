import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/admin/users/$userid/roles')({
  component: () => null,
});
