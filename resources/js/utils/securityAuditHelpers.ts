import { cn } from './cn';
import { theme } from '../theme';

export function getSeverityBadgeStyle(severity: string): string {
  switch (severity) {
    case 'critical':
      return cn(theme.badges.tag.base, theme.badges.tag.danger);
    case 'high':
      return cn(theme.badges.tag.base, theme.badges.tag.warning);
    case 'medium':
      return cn(theme.badges.tag.base, theme.badges.tag.warning);
    case 'low':
      return cn(theme.badges.tag.base, theme.badges.tag.info);
    default:
      return cn(theme.badges.tag.base, theme.badges.tag.neutral);
  }
}

export function getCategoryBadgeStyle(category: string): string {
  switch (category) {
    case 'auth':
      return cn(theme.badges.tag.base, theme.badges.tag.info);
    case 'user_mgmt':
      return cn(theme.badges.tag.base, theme.badges.tag.info);
    case 'rbac':
      return cn(theme.badges.tag.base, theme.badges.tag.warning);
    case 'server':
      return cn(theme.badges.tag.base, theme.badges.tag.success);
    case 'file':
      return cn(theme.badges.tag.base, theme.badges.tag.warning);
    default:
      return cn(theme.badges.tag.base, theme.badges.tag.neutral);
  }
}
