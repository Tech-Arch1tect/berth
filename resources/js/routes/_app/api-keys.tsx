import { createFileRoute } from '@tanstack/react-router';
import APIKeysIndex from '../../features/apikeys/pages/Index';

export const Route = createFileRoute('/_app/api-keys')({
  component: APIKeysIndex,
});
