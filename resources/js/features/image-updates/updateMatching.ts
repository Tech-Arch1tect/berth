import type { ImageUpdate } from '../../api/generated/models';
import type { ComposeService } from '../../api/generated/models';

export function updateForContainer(
  updates: ImageUpdate[] | undefined,
  containerName: string,
  stackName: string
): ImageUpdate | undefined {
  if (!updates) return undefined;
  return updates.find(
    (u) =>
      u.container_name === containerName ||
      containerName.startsWith(`${stackName}-${u.container_name}-`)
  );
}

export function serviceUpdateCount(
  updates: ImageUpdate[] | undefined,
  service: Pick<ComposeService, 'name' | 'containers'>
): number {
  if (!updates || updates.length === 0) return 0;
  const containerNames = new Set((service.containers ?? []).map((c) => c.name));
  return updates.filter(
    (u) =>
      !u.check_error &&
      u.update_available &&
      (u.container_name === service.name || containerNames.has(u.container_name))
  ).length;
}
