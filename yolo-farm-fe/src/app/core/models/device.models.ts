export type DeviceStatus = 'ONLINE' | 'OFFLINE';

export interface Device {
  id: number;
  deviceId: string;
  name: string;
  status: DeviceStatus;
}

export interface DeviceRequest {
  deviceId: string;
  name: string;
}
