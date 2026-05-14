export interface ControlRequest {
  deviceId: string;
  command: string;
  action: string;
}

export interface ControlResponse {
  deviceId: string;
  command: string;
  action: string;
  createdAt: string;
}

export interface DeviceActionLog {
  id: number;
  deviceId: string;
  component: string;
  action: string;
  executedBy: string | null;
  executedAt: string;
}

export interface DeviceActionLogQuery {
  component?: string;
  startDate?: string;
  endDate?: string;
  page: number;
  size: number;
}
