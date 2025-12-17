// Sidebar
export { DashboardSidebar } from './sidebar/DashboardSidebar';

// Content
export { DashboardPage, SECTION_IDS } from './content/DashboardPage';

// Toolbar & Statusbar
export { DashboardToolbar } from './toolbar/DashboardToolbar';
export { DashboardStatusBar } from './statusbar/DashboardStatusBar';

// Panels
export { OverviewPanel } from './panels/OverviewPanel';
export { ServerDetailPanel } from './panels/ServerDetailPanel';
export { ActivityPanel } from './panels/ActivityPanel';
export { AlertsPanel } from './panels/AlertsPanel';

// Shared components (used by other pages)
export { default as ServerCard } from './ServerCard';
export { StackCard } from './StackCard';
export { default as EmptyServerState } from './EmptyServerState';

// Hooks
export { useDashboardHealth } from './hooks/useDashboardHealth';
export { useDashboardActivity } from './hooks/useDashboardActivity';

// Types
export type { HealthSummary, DashboardStat } from './types/dashboard';
export type { ActivitySummary, RecentActivity } from './hooks/useDashboardActivity';
