import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_public/auth/totp/verify')({
  component: () => null,
});
