import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PageResponse } from '../models/api.models';
import { LatestTelemetry, TelemetryData, TelemetrySensorType } from '../models/telemetry.models';
import { ApiClientService } from './api-client.service';

@Injectable({
  providedIn: 'root'
})
export class TelemetryService {
  private readonly api = inject(ApiClientService);

  getLatestTelemetry(deviceId: string): Observable<LatestTelemetry> {
    return this.api.get<LatestTelemetry>(`/api/telemetry/${deviceId}/latest`);
  }

  getTelemetryHistory(
    deviceId: string,
    page: number,
    size: number,
    sensorType: TelemetrySensorType
  ): Observable<PageResponse<TelemetryData>> {
    return this.api.get<PageResponse<TelemetryData>>(`/api/telemetry/history/${deviceId}`, {
      params: {
        page,
        size,
        sensorType
      }
    });
  }
}
