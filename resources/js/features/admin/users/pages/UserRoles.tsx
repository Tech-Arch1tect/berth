import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { cn } from '../../../../shared/utils/cn';
import { theme } from '../../../../shared/theme';
import { Breadcrumb } from '../../../../shared/components/Breadcrumb';
import { ConfirmationModal } from '../../../../shared/components/ConfirmationModal';
import { LoadingSpinner } from '../../../../shared/components/LoadingSpinner';
import { useDocumentTitle } from '../../../../shared/hooks/useDocumentTitle';
import { CheckCircleIcon } from '@heroicons/react/24/outline';
import {
  useGetApiV1AdminUsersIdRoles,
  usePostApiV1AdminUsersAssignRole,
  usePostApiV1AdminUsersRevokeRole,
  getGetApiV1AdminUsersIdRolesQueryKey,
} from '../../../../api/generated/admin/admin';
import type { RoleInfo } from '../../../../api/generated/models';

export default function UserRoles() {
  useDocumentTitle('User Roles');
  const queryClient = useQueryClient();
  const params = useParams({ strict: false }) as { userid?: string };
  const userid = Number(params.userid);
  const [error, setError] = useState<string | null>(null);
  const [roleToRemove, setRoleToRemove] = useState<RoleInfo | null>(null);

  const { data: rolesResponse, isLoading: rolesLoading } = useGetApiV1AdminUsersIdRoles(userid, {
    query: { enabled: Number.isFinite(userid) && userid > 0 },
  });
  const user = rolesResponse?.data?.user;
  const allRoles = rolesResponse?.data?.all_roles ?? [];

  const invalidateUserRoles = () =>
    queryClient.invalidateQueries({ queryKey: getGetApiV1AdminUsersIdRolesQueryKey(userid) });

  const assignRoleMutation = usePostApiV1AdminUsersAssignRole();
  const revokeRoleMutation = usePostApiV1AdminUsersRevokeRole();

  const processing = assignRoleMutation.isPending || revokeRoleMutation.isPending;

  const assignRole = (roleId: number) => {
    if (processing || !user) return;
    setError(null);

    assignRoleMutation.mutate(
      { data: { user_id: user.id, role_id: roleId } },
      {
        onSuccess: () => {
          invalidateUserRoles();
        },
        onError: (err) => {
          const errorData = err as { message?: string };
          setError(errorData.message || 'Failed to assign role');
        },
      }
    );
  };

  const confirmRemoveRole = () => {
    if (!roleToRemove || !user) return;
    setError(null);

    revokeRoleMutation.mutate(
      { data: { user_id: user.id, role_id: roleToRemove.id } },
      {
        onSuccess: () => {
          invalidateUserRoles();
          setRoleToRemove(null);
        },
        onError: (err) => {
          const errorData = err as { message?: string };
          setError(errorData.message || 'Failed to remove role');
          setRoleToRemove(null);
        },
      }
    );
  };

  if (rolesLoading || !user) {
    return <LoadingSpinner size="lg" text="Loading user..." fullScreen />;
  }

  const assignedRoleIds = (user.roles ?? []).map((role) => role.id);

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-3xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <Breadcrumb
          homeHref="/admin/users"
          items={[{ label: 'Users', href: '/admin/users' }, { label: user.username }]}
        />

        <div className="mb-6">
          <h1 className={cn('text-2xl font-bold sm:text-3xl', theme.text.strong)}>User Roles</h1>
          <p className={cn('mt-1 text-sm', theme.text.subtle)}>
            Roles assigned to {user.username} ({user.email})
          </p>
        </div>

        {error && (
          <div
            className={cn(
              'mb-4 p-4 rounded-md border',
              theme.intent.danger.surface,
              theme.intent.danger.border
            )}
          >
            <p className={cn('text-sm', theme.intent.danger.textStrong)}>{error}</p>
          </div>
        )}

        <div className={cn(theme.surface.panel, 'shadow overflow-hidden rounded-md')}>
          <ul className="divide-y divide-slate-200 dark:divide-slate-700">
            {allRoles.map((role) => {
              const assigned = assignedRoleIds.includes(role.id);
              return (
                <li key={role.id} className="px-4 py-4 sm:px-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className={cn('text-sm font-medium capitalize', theme.text.strong)}>
                          {role.name}
                        </h3>
                        {assigned && (
                          <span
                            className={cn(
                              theme.badges.tag.base,
                              theme.badges.tag.success,
                              'inline-flex items-center gap-1'
                            )}
                          >
                            <CheckCircleIcon className="h-3.5 w-3.5" />
                            Assigned
                          </span>
                        )}
                      </div>
                      {role.description && (
                        <p className={cn('mt-0.5 text-sm', theme.text.subtle)}>
                          {role.description}
                        </p>
                      )}
                    </div>
                    {assigned ? (
                      <button
                        onClick={() => setRoleToRemove(role)}
                        disabled={processing}
                        aria-label={`Remove role ${role.name} from ${user.username}`}
                        className={cn(
                          'inline-flex min-h-[44px] items-center text-sm disabled:opacity-50',
                          theme.buttons.danger
                        )}
                      >
                        Remove
                      </button>
                    ) : (
                      <button
                        onClick={() => assignRole(role.id)}
                        disabled={processing}
                        aria-label={`Assign role ${role.name} to ${user.username}`}
                        className={cn(
                          'inline-flex min-h-[44px] items-center text-sm disabled:opacity-50',
                          theme.buttons.secondary
                        )}
                      >
                        Assign
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
            {allRoles.length === 0 && (
              <li className={cn('px-4 py-4 text-sm sm:px-6', theme.text.subtle)}>
                No roles defined
              </li>
            )}
          </ul>
        </div>
      </div>

      <ConfirmationModal
        isOpen={roleToRemove !== null}
        onClose={() => setRoleToRemove(null)}
        onConfirm={confirmRemoveRole}
        title="Remove Role"
        message={`Remove the role "${roleToRemove?.name}" from ${user.username}? They will lose the access this role grants.`}
        confirmText="Remove"
        variant="danger"
        isLoading={revokeRoleMutation.isPending}
      />
    </div>
  );
}
