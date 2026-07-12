import type { Component, Run, RunSummary } from '../../api/generated/models';

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

export function latestRepoSizeBytes(summaries: RunSummary[]): number | null {
  for (const summary of summaries) {
    if (summary.repo_size_bytes) {
      return summary.repo_size_bytes;
    }
  }
  return null;
}
