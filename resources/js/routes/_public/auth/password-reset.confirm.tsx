import { createFileRoute } from '@tanstack/react-router';
import PasswordResetConfirm from '../../../features/auth/pages/PasswordResetConfirm';

export const Route = createFileRoute('/_public/auth/password-reset/confirm')({
  component: PasswordResetConfirm,
});
