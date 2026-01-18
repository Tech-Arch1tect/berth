import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { cn } from '../../utils/cn';
import { theme } from '../../theme';

interface UpdateConfigFormProps {
  changeTag: boolean;
  pullImages: boolean;
  newTag: string;
  selectedCount: number;
  onChangeTagToggle: (checked: boolean) => void;
  onPullImagesToggle: (checked: boolean) => void;
  onNewTagChange: (tag: string) => void;
  onStartUpdate: () => void;
}

export function UpdateConfigForm({
  changeTag,
  pullImages,
  newTag,
  selectedCount,
  onChangeTagToggle,
  onPullImagesToggle,
  onNewTagChange,
  onStartUpdate,
}: UpdateConfigFormProps) {
  return (
    <div className={cn('rounded-lg p-6 mb-6', theme.surface.panel)}>
      <h2 className={cn('text-lg font-medium mb-4', theme.text.strong)}>Update Configuration</h2>

      <div className="space-y-4">
        <div>
          <label className={cn('block mb-3', theme.forms.label)}>Update Options</label>
          <div className="space-y-3">
            <label className="flex items-start">
              <input
                type="checkbox"
                checked={changeTag}
                onChange={(e) => onChangeTagToggle(e.target.checked)}
                className="mt-0.5 mr-3 rounded border-gray-300 dark:border-gray-600"
              />
              <div>
                <span className={theme.text.standard}>Change image tag</span>
                <p className={cn('text-sm', theme.text.muted)}>
                  Update compose file with a new image tag before restarting
                </p>
              </div>
            </label>
            <label className="flex items-start">
              <input
                type="checkbox"
                checked={pullImages}
                onChange={(e) => onPullImagesToggle(e.target.checked)}
                className="mt-0.5 mr-3 rounded border-gray-300 dark:border-gray-600"
              />
              <div>
                <span className={theme.text.standard}>Pull images</span>
                <p className={cn('text-sm', theme.text.muted)}>
                  Pull latest images before restarting (disable if images are already pulled)
                </p>
              </div>
            </label>
          </div>
        </div>

        {changeTag && (
          <div className="ml-6">
            <label className={cn('block mb-2', theme.forms.label)}>New Image Tag</label>
            <input
              type="text"
              value={newTag}
              onChange={(e) => onNewTagChange(e.target.value)}
              placeholder="e.g., v1.2.0, main, latest"
              className={cn('w-full max-w-md', theme.forms.input)}
            />
            <p className={cn('mt-1 text-sm', theme.text.subtle)}>
              Applied to: berth-agent, berth-updater, berth-socket-proxy, berth-grype-scanner
            </p>
          </div>
        )}

        <div className={cn('p-4 rounded-lg', theme.intent.warning.surface)}>
          <div className="flex items-start">
            <ExclamationTriangleIcon
              className={cn('h-5 w-5 mr-2 flex-shrink-0', theme.intent.warning.textStrong)}
            />
            <div>
              <p className={cn('font-medium', theme.intent.warning.textStrong)}>Warning</p>
              <ul className={cn('text-sm mt-1 space-y-1', theme.intent.warning.textMuted)}>
                <li>• Updates will be executed one server at a time</li>
                <li>• Each agent will be offline briefly during restart</li>
                <li>• The update will stop on the first failure</li>
                <li>• Do not close this browser tab during the update</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={onStartUpdate}
            disabled={selectedCount === 0}
            className={cn(theme.buttons.primary, 'disabled:opacity-50')}
          >
            Start Update ({selectedCount} agent{selectedCount !== 1 ? 's' : ''})
          </button>
        </div>
      </div>
    </div>
  );
}
