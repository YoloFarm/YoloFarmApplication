import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Device, DeviceRequest } from '../models/device.models';
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
