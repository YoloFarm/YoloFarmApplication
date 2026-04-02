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
