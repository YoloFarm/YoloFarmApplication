export type ScheduleAction = 'ON' | 'OFF' | string;

export interface ScheduleRequest {
  deviceId: string;
  command: string;
  action: ScheduleAction;
  cronExpression: string;
  description?: string;
}

export interface ScheduleResponse {
  id: number;
  deviceId: string;
  command: string;
  action: string;
  cronExpression: string;
  description?: string | null;
  active: boolean;
  createdAt: string;
}
