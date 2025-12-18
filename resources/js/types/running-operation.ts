export interface RunningOperation {
  id: number;
  user_id: number;
  server_id: number;
  stack_name: string;
  operation_id: string;
  command: string;
  start_time: string;
  last_message_at: string | null;
  user_name: string;
  server_name: string;
  is_incomplete: boolean;
  partial_duration: number | null;
  message_count: number;
  summary: string | null;
}
