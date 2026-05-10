import { createFileRoute } from '@tanstack/react-router';
import Profile from '../../features/auth/pages/Profile';

export const Route = createFileRoute('/_app/profile')({
  component: Profile,
});
