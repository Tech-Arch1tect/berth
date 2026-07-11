import type { Component, Run } from '../../api/generated/models';

export type StopMode = '' | 'stop' | 'pause';

export function buildCreateBackupOptions(stopMode: StopMode): string[] {
  if (stopMode === 'stop') return ['--stop'];
  if (stopMode === 'pause') return ['--pause'];
  return [];
}

export function describeComponent(component: Component): { label: string; detail: string } {
  switch (component.kind) {
    case 'stack-directory':
      return { label: 'Stack directory', detail: component.source_path ?? '' };
    case 'volume':
      return { label: 'Volume', detail: component.volume_name ?? '' };
    case 'bind-mount':
      return { label: 'Bind mount', detail: component.source_path ?? '' };
    case 'anonymous-volume':
      return {
        label: 'Anonymous volume',
        detail: [component.service, component.target].filter(Boolean).join(' at '),
      };
    default:
      return { label: component.kind, detail: component.id };
  }
}

export function runBytesAdded(run: Run): number {
  return run.components.reduce((total, component) => total + (component.bytes_added ?? 0), 0);
}

export function runHasComponentErrors(run: Run): boolean {
  return run.components.some((component) => !!component.error);
}

export function describeStopMode(stopMode: string | undefined): string {
  if (stopMode === 'stop') return 'Stack stopped during backup';
  if (stopMode === 'pause') return 'Stack paused during backup';
  return 'Stack kept running';
}

export function restorableComponents(run: Run): Component[] {
  return run.components.filter((component) => !!component.snapshot_id);
}

export function buildRestoreOptions(
  backupId: string,
  componentIds: string[],
  keepExtraFiles: boolean
): string[] {
  const options = ['--backup-id', backupId];
  for (const id of componentIds) {
    options.push('--component', id);
  }
  options.push('--stop');
  if (keepExtraFiles) {
    options.push('--keep-extra-files');
  }
  return options;
}
