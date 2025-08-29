import type { StackDetails } from './stack';

export interface UseStackDetailsParams {
  serverid: number;
  stackname: string;
}

export type StackDetailsResponse = StackDetails;
