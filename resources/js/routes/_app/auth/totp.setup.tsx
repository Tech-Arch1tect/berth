import { createFileRoute } from '@tanstack/react-router';
import TOTPSetup from '../../../features/auth/pages/TOTPSetup';

export const Route = createFileRoute('/_app/auth/totp/setup')({
  component: TOTPSetup,
});
