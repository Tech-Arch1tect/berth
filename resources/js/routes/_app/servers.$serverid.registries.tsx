import { createFileRoute } from '@tanstack/react-router';
import Registries from '../../features/registries/pages/Registries';

export const Route = createFileRoute('/_app/servers/$serverid/registries')({
  component: Registries,
});
