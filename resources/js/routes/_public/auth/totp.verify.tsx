import { createFileRoute } from '@tanstack/react-router';
import TOTPVerify from '../../../features/auth/pages/TOTPVerify';

export const Route = createFileRoute('/_public/auth/totp/verify')({
  component: TOTPVerify,
});
