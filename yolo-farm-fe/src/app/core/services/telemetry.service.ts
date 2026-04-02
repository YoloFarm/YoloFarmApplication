import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PageResponse } from '../models/api.models';
import { TelemetryData } from '../models/telemetry.models';
import { ApiClientService } from './api-client.service';

@Injectable({ providedIn: 'root' })
export class TelemetryService {
  private readonly api = inject(ApiClientService);

  getLatestTelemetry(deviceId: string, sensorType: string = 'TEMP'): Observable<TelemetryData> {
    return this.api.get<TelemetryData>(`/api/telemetry/latest/${deviceId}`, {
      params: { sensorType }
    });
  }

  getTelemetryHistory(deviceId: string, page = 0, size = 20, sensorType: string = 'TEMP'): Observable<PageResponse<TelemetryData>> {
    return this.api.get<PageResponse<TelemetryData>>(`/api/telemetry/history/${deviceId}`, {
      params: { page, size, sensorType }
    });
  }
}
