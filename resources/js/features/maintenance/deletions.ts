import type { ContainerInfo, ImageInfo, NetworkInfo, VolumeInfo } from '../../api/generated/models';

export const containerCount = (count: number) => `${count} container${count === 1 ? '' : 's'}`;

export const imageDeleteBlockedReason = (image: ImageInfo): string | undefined =>
  image.containers > 0
    ? `${containerCount(image.containers)} still use this image. Remove them first.`
    : undefined;

export const containerDeleteBlockedReason = (container: ContainerInfo): string | undefined =>
  container.removal === 'never'
    ? `This container is ${container.state}. Stop it before removing it.`
    : undefined;

export const volumeDeleteBlockedReason = (volume: VolumeInfo): string | undefined =>
  volume.unused ? undefined : 'A container still mounts this volume. Remove it first.';

export const networkDeleteBlockedReason = (network: NetworkInfo): string | undefined =>
  network.unused ? undefined : 'This network is in use or built into Docker.';
