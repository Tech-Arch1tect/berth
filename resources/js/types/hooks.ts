import type { StackDetails } from './stack';

export interface UseStackDetailsParams {
  serverId: number;
  stackName: string;
}

export type StackDetailsResponse = StackDetails;
