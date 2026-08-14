import { useState } from 'react';
import { Modal } from '../../../shared/components/Modal';
import { cn } from '../../../shared/utils/cn';
import { theme } from '../../../shared/theme';
import { BACKUP_LABEL_MAX_LENGTH, isValidBackupLabel, type StopMode } from '../utils';

interface BackupOptionsModalProps {
  isOpen: boolean;
  stackname: string;
  isStarting: boolean;
  onClose: () => void;
  onConfirm: (stopMode: StopMode, label: string) => void;
}

const CHOICES: Array<{ value: StopMode; label: string; description: string }> = [
  {
    value: '',
    label: 'Keep the stack running',
    description:
      'Files are copied while the stack runs. Applications writing during the backup (databases in particular) may leave an inconsistent copy.',
  },
  {
    value: 'stop',
    label: 'Stop the stack first',
    description:
      'Runs "docker compose stop" before the backup and "docker compose start" after. The stack is offline for the duration of the backup.',
  },
  {
    value: 'pause',
    label: 'Pause the stack first',
    description:
      'Runs "docker compose pause" before the backup and "docker compose unpause" after. Processes are frozen but not stopped while files are copied.',
  },
];

export function BackupOptionsModal({
  isOpen,
  stackname,
  isStarting,
  onClose,
  onConfirm,
}: BackupOptionsModalProps) {
  const [stopMode, setStopMode] = useState<StopMode>('');
  const [label, setLabel] = useState('');
  const trimmed = label.trim();
  const labelValid = isValidBackupLabel(label);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Back up ${stackname}`}
      subtitle="The stack directory, bind mounts and volumes are backed up incrementally"
      size="md"
      fullScreenOnMobile
      footer={
        <div className="flex w-full gap-2 justify-end">
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
            onClick={() => onConfirm(stopMode, label)}
            disabled={isStarting || !labelValid}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium min-h-[44px]',
              'bg-teal-600 text-white hover:bg-teal-500 disabled:opacity-50'
            )}
          >
            {isStarting ? 'Starting…' : 'Back up'}
          </button>
        </div>
      }
    >
      <div className="mb-5">
        <label
          htmlFor="backup-label"
          className={cn('mb-1 block text-sm font-medium', theme.text.strong)}
        >
          Description (optional)
        </label>
        <input
          id="backup-label"
          type="text"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          maxLength={BACKUP_LABEL_MAX_LENGTH}
          placeholder="e.g. pre upgrade to v1.2.3"
          className={cn(
            'min-h-[44px] w-full rounded-lg border px-3 text-sm',
            'border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-400',
            'dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100'
          )}
        />
        {!labelValid && (
          <p className={cn('mt-1 text-xs', theme.text.danger)}>
            Letters, numbers, spaces and . , _ - + ( ) / : ' only, starting with a letter or number.
          </p>
        )}
        {labelValid && trimmed.length > 0 && (
          <p className={cn('mt-1 text-xs', theme.text.muted)}>
            Shown next to the backup in the list.
          </p>
        )}
      </div>
      <fieldset className="space-y-2">
        <legend className={cn('text-sm font-medium mb-2', theme.text.strong)}>
          While the backup runs
        </legend>
        {CHOICES.map((choice) => (
          <label
            key={choice.value || 'live'}
            className={cn(
              'flex gap-3 rounded-lg border p-3 cursor-pointer min-h-[44px]',
              stopMode === choice.value
                ? 'border-teal-500 ring-1 ring-teal-500'
                : 'border-zinc-200 dark:border-zinc-700'
            )}
          >
            <input
              type="radio"
              name="backup-stop-mode"
              className="mt-1 shrink-0"
              checked={stopMode === choice.value}
              onChange={() => setStopMode(choice.value)}
            />
            <span>
              <span className={cn('block text-sm font-medium', theme.text.strong)}>
                {choice.label}
              </span>
              <span className={cn('block text-xs mt-0.5', theme.text.muted)}>
                {choice.description}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
    </Modal>
  );
}
