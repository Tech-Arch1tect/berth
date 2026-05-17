import type { UserInfo } from '../../api/generated/models';

export function userIsAdmin(user: UserInfo | null | undefined): boolean {
  return user?.roles?.some((role) => role.name === 'admin') ?? false;
}
