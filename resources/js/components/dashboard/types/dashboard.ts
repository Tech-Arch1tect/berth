export interface HealthSummary {
  totalStacks: number;
  healthyStacks: number;
  unhealthyStacks: number;
  serversWithErrors: number;
  serversLoading: number;
  serversOnline: number;
  totalActiveServers: number;
  totalOfflineServers: number;
  actuallyReachableServers: number;
}

export interface DashboardStat {
  name: string;
  value: string;
  subtitle?: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  color: 'blue' | 'green' | 'amber' | 'red' | 'emerald';
  trend: 'good' | 'warning' | 'neutral';
}
