import { createFileRoute } from '@tanstack/react-router';
import APIKeyScopesPage from '../../features/apikeys/pages/Scopes';

export const Route = createFileRoute('/_app/api-keys/$keyid/scopes')({
  component: APIKeyScopesPage,
});
