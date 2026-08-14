import type { Component, Run, RunSummary } from '../../api/generated/models';

export type StopMode = '' | 'stop' | 'pause';

export const BACKUP_LABEL_MAX_LENGTH = 100;

const backupLabelPattern = /^[A-Za-z0-9][A-Za-z0-9 .,_+()/:'-]*$/;

export function isValidBackupLabel(label: string): boolean {
  const trimmed = label.trim();
  return (
    trimmed === '' ||
    (trimmed.length <= BACKUP_LABEL_MAX_LENGTH && backupLabelPattern.test(trimmed))
  );
}

export function buildCreateBackupOptions(stopMode: StopMode, label = ''): string[] {
  const options: string[] = [];
  if (stopMode === 'stop') options.push('--stop');
  if (stopMode === 'pause') options.push('--pause');
  const trimmed = label.trim();
  if (trimmed) options.push('--label', trimmed);
  return options;
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
  keepExtraFiles: boolean,
  sparse: boolean
): string[] {
  const options = ['--backup-id', backupId];
  for (const id of componentIds) {
    options.push('--component', id);
  }
  options.push('--stop');
  if (keepExtraFiles) {
    options.push('--keep-extra-files');
  }
  if (sparse) {
    options.push('--sparse');
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
