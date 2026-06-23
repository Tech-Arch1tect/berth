// Sidebar
export { DashboardSidebar } from './sidebar/DashboardSidebar';

// Content
export { DashboardPage, SECTION_IDS } from './content/DashboardPage';

// Toolbar & Statusbar
export { DashboardToolbar } from './toolbar/DashboardToolbar';
export { DashboardStatusBar } from './statusbar/DashboardStatusBar';

// Shared components (used by other pages)
export { StackCard } from './StackCard';

// Hooks
export { useDashboardActivity } from '../hooks/useDashboardActivity';

// Types
export type { HealthSummary, DashboardStat } from '../types';
export type { ActivitySummary } from '../hooks/useDashboardActivity';
