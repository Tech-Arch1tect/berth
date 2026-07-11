import { useEffect, useState } from 'react';
import type { Run } from '../../../api/generated/models';
import { Modal } from '../../../shared/components/Modal';
import { cn } from '../../../shared/utils/cn';
import { theme } from '../../../shared/theme';
import { formatDate } from '../../../shared/utils/formatters';
import { describeComponent, restorableComponents } from '../utils';

interface RestoreBackupModalProps {
  isOpen: boolean;
  run: Run;
  stackname: string;
  isStarting: boolean;
  onClose: () => void;
  onConfirm: (componentIds: string[], keepExtraFiles: boolean) => void;
}

export function RestoreBackupModal({
  isOpen,
  run,
  stackname,
  isStarting,
  onClose,
  onConfirm,
}: RestoreBackupModalProps) {
  const restorable = restorableComponents(run);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [keepExtraFiles, setKeepExtraFiles] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelected(new Set(restorable.map((component) => component.id)));
      setKeepExtraFiles(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, run.id]);

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const notRestorable = run.components.filter((component) => !component.snapshot_id);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Restore backup into ${stackname}`}
      subtitle={`Backup from ${formatDate(run.started_at)}`}
      size="md"
      fullScreenOnMobile
      footer={
        <div className="flex w-full flex-col gap-2">
          <p className={cn('text-xs', 'text-red-700 dark:text-red-400')}>
            This overwrites the selected data of {stackname} with its state from{' '}
            {formatDate(run.started_at)}. The stack is stopped for the restore and started again
            afterwards.
          </p>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isStarting}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium min-h-[44px]',
                theme.surface.muted,
                theme.text.standard
              )}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onConfirm([...selected], keepExtraFiles)}
              disabled={isStarting || selected.size === 0}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium min-h-[44px]',
                'bg-red-600 text-white hover:bg-red-500 disabled:opacity-50'
              )}
            >
              {isStarting
                ? 'Starting…'
                : `Restore ${selected.size} ${selected.size === 1 ? 'component' : 'components'}`}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <fieldset className="space-y-2">
          <legend className={cn('text-sm font-medium mb-2', theme.text.strong)}>
            What to restore
          </legend>
          {restorable.map((component) => {
            const { label, detail } = describeComponent(component);
            return (
              <label
                key={component.id}
                className={cn(
                  'flex gap-3 rounded-lg border p-3 cursor-pointer min-h-[44px]',
                  selected.has(component.id)
                    ? 'border-teal-500 ring-1 ring-teal-500'
                    : 'border-zinc-200 dark:border-zinc-700'
                )}
              >
                <input
                  type="checkbox"
                  className="mt-1 shrink-0"
                  checked={selected.has(component.id)}
                  onChange={() => toggle(component.id)}
                />
                <span className="min-w-0">
                  <span className={cn('block text-sm font-medium', theme.text.strong)}>
                    {label}
                  </span>
                  {detail && (
                    <span className={cn('block text-xs font-mono break-all', theme.text.muted)}>
                      {detail}
                    </span>
                  )}
                </span>
              </label>
            );
          })}
          {notRestorable.map((component) => {
            const { label, detail } = describeComponent(component);
            return (
              <div
                key={component.id}
                className={cn(
                  'rounded-lg border border-dashed p-3',
                  'border-zinc-200 dark:border-zinc-700'
                )}
              >
                <span className={cn('block text-sm', theme.text.subtle)}>
                  {label} {detail && <span className="font-mono">{detail}</span>} — cannot be
                  restored (no snapshot was taken during this backup)
                </span>
              </div>
            );
          })}
        </fieldset>

        <label className="flex gap-3 items-start cursor-pointer">
          <input
            type="checkbox"
            className="mt-1 shrink-0"
            checked={keepExtraFiles}
            onChange={() => setKeepExtraFiles((value) => !value)}
          />
          <span>
            <span className={cn('block text-sm font-medium', theme.text.strong)}>
              Keep files created after this backup
            </span>
            <span className={cn('block text-xs mt-0.5', theme.text.muted)}>
              By default the restored data matches the backup exactly, removing files that did not
              exist when it was taken. Keeping later files can leave applications (databases in
              particular) with inconsistent state.
            </span>
          </span>
        </label>
      </div>
    </Modal>
  );
}
