import { createFileRoute } from '@tanstack/react-router';
import SessionsIndex from '../../features/sessions/pages/Index';

export const Route = createFileRoute('/_app/sessions')({
  component: SessionsIndex,
});
