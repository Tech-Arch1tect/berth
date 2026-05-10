import { createFileRoute } from '@tanstack/react-router';
import VerifyEmail from '../../../features/auth/pages/VerifyEmail';

export const Route = createFileRoute('/_public/auth/verify-email')({
  component: VerifyEmail,
});
