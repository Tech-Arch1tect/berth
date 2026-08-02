import type { BuildCacheInfo, MaintenanceInfo } from '../../api/generated/models';

export type PruneType = 'images' | 'containers' | 'volumes' | 'networks' | 'build-cache' | 'system';

export const PRUNE_TYPES: PruneType[] = [
  'images',
  'containers',
  'volumes',
  'networks',
  'build-cache',
  'system',
];

export const pruneTypeLabels: Record<PruneType, string> = {
  images: 'Images',
  containers: 'Containers',
  volumes: 'Volumes',
  networks: 'Networks',
  'build-cache': 'Build Cache',
  system: 'System',
};

const pruneDescriptions: Record<PruneType, { default: string; all?: string }> = {
  images: {
    default: 'Removes dangling images that no container uses. Same as docker image prune.',
    all: 'Removes every image that no container uses. Same as docker image prune -a.',
  },
  containers: {
    default:
      'Removes containers that are not running, paused or restarting. Same as docker container prune.',
  },
  volumes: {
    default: 'Removes unused anonymous volumes. Same as docker volume prune.',
    all: 'Removes every unused local volume, including named ones. Same as docker volume prune -a.',
  },
  networks: {
    default: 'Removes networks with no container attached. Same as docker network prune.',
  },
  'build-cache': {
    default:
      'Removes unused build cache that is not shared with an image. Same as docker builder prune.',
    all: 'Removes all unused build cache. Same as docker builder prune -a.',
  },
  system: {
    default:
      'Removes stopped containers, unused networks, dangling images and unused build cache. Volumes are never touched.',
    all: 'Removes stopped containers, unused networks, every unused image and all unused build cache. Volumes are never touched.',
  },
};

export const supportsAllMode = (type: PruneType) => pruneDescriptions[type].all !== undefined;

export const pruneDescription = (type: PruneType, all: boolean) => {
  const copy = pruneDescriptions[type];
  return all && copy.all ? copy.all : copy.default;
};

export const allModeLabels: Partial<Record<PruneType, string>> = {
  images: 'Remove every unused image, not just dangling ones',
  volumes: 'Remove every unused volume, not just anonymous ones',
  'build-cache': 'Remove all unused build cache, including entries shared with images',
  system: 'Remove every unused image and all unused build cache, not just dangling entries',
};

export interface RemovalRow {
  key: string;
  category: string;
  name: string;
  detail?: string;
  size?: number;
  uniqueSize?: number;
  lastUsed?: string | null;
}

const willBeRemoved = (removal: string, all: boolean) =>
  removal === 'always' || (all && removal === 'with_all');

const imageRows = (info: MaintenanceInfo, all: boolean): RemovalRow[] =>
  info.image_summary.images
    .filter((image) => willBeRemoved(image.removal, all))
    .map((image) => ({
      key: `image:${image.id}`,
      category: 'Images',
      name: image.tags.length > 0 ? image.tags.join(', ') : '<untagged>',
      detail: image.id.substring(0, 12),
      size: image.size,
      uniqueSize: image.shared_size >= 0 ? image.size - image.shared_size : undefined,
    }));

const containerRows = (info: MaintenanceInfo, all: boolean): RemovalRow[] =>
  info.container_summary.containers
    .filter((container) => willBeRemoved(container.removal, all))
    .map((container) => ({
      key: `container:${container.id}`,
      category: 'Containers',
      name: container.name || container.id.substring(0, 12),
      detail: container.status,
      size: container.size,
    }));

const volumeRows = (info: MaintenanceInfo, all: boolean): RemovalRow[] =>
  info.volume_summary.volumes
    .filter((volume) => willBeRemoved(volume.removal, all))
    .map((volume) => ({
      key: `volume:${volume.name}`,
      category: 'Volumes',
      name: volume.name,
      detail: volume.anonymous ? 'anonymous' : 'named',
      size: volume.size,
    }));

const networkRows = (info: MaintenanceInfo, all: boolean): RemovalRow[] =>
  info.network_summary.networks
    .filter((network) => willBeRemoved(network.removal, all))
    .map((network) => ({
      key: `network:${network.id}`,
      category: 'Networks',
      name: network.name,
      detail: network.driver,
    }));

const buildCacheDetail = (record: BuildCacheInfo): string => {
  const parts = [record.type];
  if (record.shared) parts.push('shared with an image');
  parts.push(record.usage_count === 1 ? 'used once' : `used ${record.usage_count} times`);
  return parts.join(', ');
};

const buildCacheRows = (info: MaintenanceInfo, all: boolean): RemovalRow[] =>
  info.build_cache_summary.cache
    .filter((record) => willBeRemoved(record.removal, all))
    .map((record) => ({
      key: `cache:${record.id}`,
      category: 'Build Cache',
      name: record.description || record.id,
      detail: buildCacheDetail(record),
      size: record.size,
      lastUsed: record.last_used,
    }));

const rowsByCategory: Record<string, (info: MaintenanceInfo, all: boolean) => RemovalRow[]> = {
  images: imageRows,
  containers: containerRows,
  volumes: volumeRows,
  networks: networkRows,
  build_cache: buildCacheRows,
};

export const removalRows = (
  info: MaintenanceInfo | undefined,
  type: PruneType,
  all: boolean
): RemovalRow[] => {
  if (!info) return [];
  if (type === 'system') {
    return info.system_cleanup_covers.flatMap(
      (category) => rowsByCategory[category]?.(info, all) ?? []
    );
  }
  const key = type === 'build-cache' ? 'build_cache' : type;
  return rowsByCategory[key]?.(info, all) ?? [];
};

const retainedCounts: Record<string, (info: MaintenanceInfo) => number> = {
  images: (info) => info.image_summary.images.filter((i) => i.removal === 'never').length,
  containers: (info) =>
    info.container_summary.containers.filter((c) => c.removal === 'never').length,
  volumes: (info) => info.volume_summary.volumes.filter((v) => v.removal === 'never').length,
  networks: (info) => info.network_summary.networks.filter((n) => n.removal === 'never').length,
  build_cache: (info) => info.build_cache_summary.cache.filter((r) => r.removal === 'never').length,
};

export const retainedCount = (info: MaintenanceInfo | undefined, type: PruneType): number => {
  if (!info) return 0;
  const categories =
    type === 'system'
      ? info.system_cleanup_covers
      : [type === 'build-cache' ? 'build_cache' : type];
  return categories.reduce((total, category) => total + (retainedCounts[category]?.(info) ?? 0), 0);
};

export const totalDiskUsage = (info: MaintenanceInfo) =>
  info.image_summary.total.size +
  info.container_summary.total.size +
  info.volume_summary.total.size +
  info.build_cache_summary.total.size;
