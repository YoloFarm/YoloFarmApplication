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

export interface DeviceComponent {
  id: number;
  deviceId: string;
  name: string;
  codeName: string;
  status: string;
}

export interface DeviceComponentRequest {
  name: string;
  codeName: string;
}
