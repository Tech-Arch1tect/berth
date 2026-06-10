import type { OperationRequest, StreamMessage } from '../../api/generated/models';

export type { OperationRequest, StreamMessage };

export type DockerOperationRequest = Omit<OperationRequest, 'command'> & {
  command: Exclude<OperationRequest['command'], 'create-archive' | 'extract-archive'>;
};

export interface OperationPreset {
  id: string;
  name: string;
  description: string;
  command: OperationRequest['command'];
  options: string[];
  icon?: string;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
}

export interface OperationStatus {
  isRunning: boolean;
  operationId?: string;
  command?: string;
  startTime?: Date;
}
