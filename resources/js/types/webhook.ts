export interface Webhook {
  id: number;
  name: string;
  description: string;
  stack_pattern: string;
  is_active: boolean;
  last_triggered: string | null;
  trigger_count: number;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  server_scopes?: number[];
}

export interface WebhookWithAPIKey extends Webhook {
  api_key: string;
}

export interface CreateWebhookRequest {
  name: string;
  description: string;
  stack_pattern: string;
  server_scopes: number[];
  expires_at: string | null;
}

export interface UpdateWebhookRequest {
  name?: string;
  description?: string;
  stack_pattern?: string;
  is_active?: boolean;
  server_scopes?: number[];
  expires_at?: string | null;
}

export interface TriggerWebhookRequest {
  api_key: string;
  server_id: number;
  stack_name: string;
  command?: string;
  options?: string[];
  services?: string[];
  operations?: TriggerOperationRequest[];
}

export interface TriggerOperationRequest {
  command: string;
  options?: string[];
  services?: string[];
}

export interface TestWebhookRequest {
  server_id: number;
  stack_name: string;
  command: string;
  options?: string[];
  services?: string[];
}

export interface WebhookTestResponse {
  webhook_id: number;
  webhook_name: string;
  test_request: TestWebhookRequest;
  message: string;
  simulated_response: {
    operation_id: string;
    command: string;
    status: string;
    position_in_queue: number;
    estimated_start_time: string;
  };
}
