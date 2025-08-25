export interface FlashMessage {
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

export interface Role {
  id: number;
  name: string;
  description: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  created_at: string;
  updated_at: string;
  roles?: Role[];
}

export * from './server';
export * from './stack';
export * from './websocket';
export * from './hooks';
