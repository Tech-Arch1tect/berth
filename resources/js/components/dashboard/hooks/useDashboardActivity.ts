import { useState, useEffect } from 'react';

export interface RecentActivity {
  id: number;
  operation_id: string;
  command: string;
  stack_name: string;
  server_name: string;
  user_name: string;
  start_time: string;
  end_time: string | null;
  success: boolean | null;
  exit_code: number | null;
  duration_ms: number | null;
  is_incomplete: boolean;
  formatted_date: string;
  partial_duration_ms: number | null;
}

export interface ActivitySummary {
  recentOperations: RecentActivity[];
  failedOperations: RecentActivity[];
  loading: boolean;
  error: string | null;
}

export const useDashboardActivity = (): ActivitySummary => {
  const [recentOperations, setRecentOperations] = useState<RecentActivity[]>([]);
  const [failedOperations, setFailedOperations] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        setLoading(true);
        setError(null);

        const recentResponse = await fetch('/api/operation-logs?page=1&page_size=10&days_back=7');
        const recentData = await recentResponse.json();
        setRecentOperations(recentData.data || []);

        const failedResponse = await fetch(
          '/api/operation-logs?page=1&page_size=5&status=failed&days_back=7'
        );
        const failedData = await failedResponse.json();
        setFailedOperations(failedData.data || []);
      } catch (err) {
        setError('Failed to load activity data');
        console.error('Error fetching dashboard activity:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchActivity();
  }, []);

  return {
    recentOperations,
    failedOperations,
    loading,
    error,
  };
};
