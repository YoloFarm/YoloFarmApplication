import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PageResponse } from '../models/api.models';
import {
  ControlRequest,
  ControlResponse,
  DeviceActionLog,
  DeviceActionLogQuery
} from '../models/control.models';
import { ApiClientService } from './api-client.service';

@Injectable({ providedIn: 'root' })
export class ControlService {
  private readonly api = inject(ApiClientService);

  sendCommand(payload: ControlRequest): Observable<ControlResponse> {
    return this.api.post<ControlResponse, ControlRequest>('/api/control', payload);
  }

  getActionLogs(
    deviceId: string,
    query: DeviceActionLogQuery
  ): Observable<PageResponse<DeviceActionLog>> {
    return this.api.get<PageResponse<DeviceActionLog>>(
      `/api/control/${encodeURIComponent(deviceId)}/logs`,
      {
        params: {
          component: query.component,
          startDate: query.startDate,
          endDate: query.endDate,
          page: query.page,
          size: query.size
        }
      }
    );
  }
}
