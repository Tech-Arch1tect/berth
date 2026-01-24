import type { FC } from 'react';
import { KeyIcon, PlusIcon, XMarkIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { cn } from '../../../utils/cn';
import { theme } from '../../../theme';
import type { GetApiV1ServersServeridRegistries200DataCredentialsItem } from '../../../api/generated/models';

interface RegistriesContentProps {
  credentials: GetApiV1ServersServeridRegistries200DataCredentialsItem[];
  showForm: boolean;
  isEditing: boolean;
  processing: boolean;
  formData: {
    stack_pattern: string;
    registry_url: string;
    image_pattern: string;
    username: string;
    password: string;
  };
  onFormDataChange: (key: string, value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  onEdit: (credential: GetApiV1ServersServeridRegistries200DataCredentialsItem) => void;
  onDelete: (id: number, url: string) => void;
  onShowAddForm: () => void;
}

export const RegistriesContent: FC<RegistriesContentProps> = ({
  credentials,
  showForm,
  isEditing,
  processing,
  formData,
  onFormDataChange,
  onSubmit,
  onCancel,
  onEdit,
  onDelete,
  onShowAddForm,
}) => {
  return (
    <div className="space-y-6">
      {/* Add/Edit Form */}
      {showForm && (
        <div className={cn(theme.containers.panel)}>
          <div className="flex items-center justify-between mb-6">
            <h2 className={cn('text-xl font-semibold', theme.text.strong)}>
              {isEditing ? 'Edit Credential' : 'Add Credential'}
            </h2>
            <button onClick={onCancel} className={cn(theme.buttons.ghost, theme.text.subtle)}>
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={cn(theme.forms.label, 'mb-2')}>Stack Pattern *</label>
                <input
                  type="text"
                  value={formData.stack_pattern}
                  onChange={(e) => onFormDataChange('stack_pattern', e.target.value)}
                  placeholder="* (all stacks) or pattern like *dev*"
                  className={cn(theme.forms.input, 'rounded-xl')}
                  required
                />
                <p className={cn('mt-1 text-xs', theme.text.subtle)}>
                  Pattern to match stack names (e.g., "*", "*dev*", "production_*")
                </p>
              </div>

              <div>
                <label className={cn(theme.forms.label, 'mb-2')}>Registry URL *</label>
                <input
                  type="text"
                  value={formData.registry_url}
                  onChange={(e) => onFormDataChange('registry_url', e.target.value)}
                  placeholder="ghcr.io or registry.company.com"
                  className={cn(theme.forms.input, 'rounded-xl')}
                  required
                />
                <p className={cn('mt-1 text-xs', theme.text.subtle)}>
                  Registry hostname (e.g., "ghcr.io", "docker.io", "registry.gitlab.com")
                </p>
              </div>

              <div>
                <label className={cn(theme.forms.label, 'mb-2')}>Image Pattern (optional)</label>
                <input
                  type="text"
                  value={formData.image_pattern}
                  onChange={(e) => onFormDataChange('image_pattern', e.target.value)}
                  placeholder="ghcr.io/myorg/*"
                  className={cn(theme.forms.input, 'rounded-xl')}
                />
                <p className={cn('mt-1 text-xs', theme.text.subtle)}>
                  Specific image pattern for more granular control
                </p>
              </div>

              <div>
                <label className={cn(theme.forms.label, 'mb-2')}>Username *</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => onFormDataChange('username', e.target.value)}
                  placeholder="registry username"
                  className={cn(theme.forms.input, 'rounded-xl')}
                  required
                />
              </div>
            </div>

            <div>
              <label className={cn(theme.forms.label, 'mb-2')}>Password / Token *</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => onFormDataChange('password', e.target.value)}
                placeholder={
                  isEditing ? 'Leave blank to keep current password' : 'registry password or token'
                }
                className={cn(theme.forms.input, 'rounded-xl')}
                required={!isEditing}
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onCancel}
                className={cn(theme.buttons.secondary, 'rounded-xl')}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={processing}
                className={cn(theme.buttons.primary, 'rounded-xl')}
              >
                {processing ? 'Saving...' : isEditing ? 'Update' : 'Add'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Credentials List */}
      <div className={cn(theme.containers.panel, 'overflow-hidden')}>
        <div className={cn(theme.containers.sectionHeader, 'p-6')}>
          <h2 className={cn('text-lg font-semibold flex items-center', theme.text.strong)}>
            <KeyIcon className={cn('w-5 h-5 mr-2', theme.text.info)} />
            Configured Credentials ({credentials.length})
          </h2>
        </div>

        {credentials.length === 0 ? (
          <div className="p-12 text-center">
            <div className={theme.icon.emptyState}>
              <KeyIcon className="w-8 h-8" />
            </div>
            <h3 className={cn('text-lg font-medium mb-2', theme.text.strong)}>
              No credentials configured
            </h3>
            <p className={cn('mb-4', theme.text.muted)}>
              Add registry credentials to enable pulling from private registries
            </p>
            <button onClick={onShowAddForm} className={cn(theme.buttons.primary, 'rounded-xl')}>
              <PlusIcon className="w-5 h-5 mr-2" />
              Add First Credential
            </button>
          </div>
        ) : (
          <div className={cn('divide-y', theme.intent.neutral.border)}>
            {credentials.map((credential) => (
              <div
                key={credential.id}
                className={cn(
                  'p-6 transition-colors',
                  theme.surface.muted,
                  'hover:bg-slate-100/70 dark:hover:bg-slate-800/70'
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className={cn('text-lg font-semibold', theme.text.strong)}>
                        {credential.registry_url}
                      </h3>
                      <span
                        className={cn(theme.badges.tag.base, theme.badges.tag.info, 'rounded-full')}
                      >
                        {credential.stack_pattern}
                      </span>
                    </div>
                    <div className={cn('space-y-1 text-sm', theme.text.muted)}>
                      <p>
                        <span className="font-medium">Username:</span> {credential.username}
                      </p>
                      {credential.image_pattern && (
                        <p>
                          <span className="font-medium">Image Pattern:</span>{' '}
                          {credential.image_pattern}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => onEdit(credential)}
                      className={cn(
                        'p-2 rounded-lg transition-colors',
                        theme.text.info,
                        'hover:bg-blue-50 dark:hover:bg-blue-900/30'
                      )}
                      title="Edit"
                    >
                      <PencilIcon className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => onDelete(credential.id, credential.registry_url)}
                      className={cn(
                        'p-2 rounded-lg transition-colors',
                        theme.text.danger,
                        'hover:bg-red-50 dark:hover:bg-red-900/30'
                      )}
                      title="Delete"
                    >
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
