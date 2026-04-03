import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  Device,
  DeviceComponent,
  DeviceComponentRequest,
  DeviceRequest
} from '../models/device.models';
import { PageResponse } from '../models/api.models';
import { ApiClientService } from './api-client.service';

@Injectable({ providedIn: 'root' })
export class DeviceService {
  private readonly api = inject(ApiClientService);

  getDevices(page = 0, size = 10): Observable<PageResponse<Device>> {
    return this.api.get<PageResponse<Device>>('/api/devices', {
      params: { page, size }
    });
  }

  getDeviceById(id: number): Observable<Device> {
    return this.api.get<Device>(`/api/devices/${id}`);
  }

  getComponentsByDeviceId(deviceId: string): Observable<DeviceComponent[]> {
    return this.api.get<DeviceComponent[]>(`/api/devices/${encodeURIComponent(deviceId)}/components`);
  }

  createComponent(deviceId: string, payload: DeviceComponentRequest): Observable<DeviceComponent> {
    return this.api.post<DeviceComponent, DeviceComponentRequest>(
      `/api/devices/${encodeURIComponent(deviceId)}/components`,
      payload
    );
  }

  createDevice(payload: DeviceRequest): Observable<Device> {
    return this.api.post<Device, DeviceRequest>('/api/devices', payload);
  }

  updateDevice(id: number, payload: DeviceRequest): Observable<Device> {
    return this.api.put<Device, DeviceRequest>(`/api/devices/${id}`, payload);
  }

  deleteDevice(id: number): Observable<string> {
    return this.api.delete<string>(`/api/devices/${id}`);
  }
}
