import { createFileRoute } from '@tanstack/react-router';
import PasswordReset from '../../../features/auth/pages/PasswordReset';

export const Route = createFileRoute('/_public/auth/password-reset')({
  component: PasswordReset,
});
