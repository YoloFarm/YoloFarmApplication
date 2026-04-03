import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map } from 'rxjs';
import { PageResponse } from '../models/api.models';
import { TelemetryData } from '../models/telemetry.models';
import { ApiClientService } from './api-client.service';

interface TelemetryResponseSingle {
  id: number;
  deviceId: string;
  sensorType: string;
  value: number | null;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class TelemetryService {
  private readonly api = inject(ApiClientService);

  getLatestTelemetry(deviceId: string, sensorType: string = 'TEMP'): Observable<TelemetryData> {
    return this.api.get<TelemetryResponseSingle>(`/api/telemetry/latest/${deviceId}`, {
      params: { sensorType }
    }).pipe(
      map((response) => this.singleToWideFormat(response))
    );
  }

  getTelemetryHistory(deviceId: string, page = 0, size = 20, sensorType: string = 'TEMP'): Observable<PageResponse<TelemetryData>> {
    return this.api.get<PageResponse<TelemetryResponseSingle>>(`/api/telemetry/history/${deviceId}`, {
      params: { page, size, sensorType }
    }).pipe(
      map((response) => ({
        ...response,
        content: response.content.map((item) => this.singleToWideFormat(item))
      }))
    );
  }

  /**
   * Transform single-sensor response to wide format (all metrics in one object).
   * Mỗi lần gọi API từ BE chỉ trả về 1 sensorType, ta phải gọi 4 lần rồi merge.
   * Hàm này là step 1: convert từng record.
   */
  private singleToWideFormat(response: TelemetryResponseSingle): TelemetryData {
    const base: TelemetryData = {
      id: response.id,
      deviceId: response.deviceId,
      temperature: null,
      humidity: null,
      soilMoisture: null,
      light: null,
      createdAt: response.createdAt
    };

    switch (response.sensorType) {
      case 'TEMP':
        base.temperature = response.value;
        break;
      case 'HUMIDITY':
        base.humidity = response.value;
        break;
      case 'SOIL_MOISTURE':
        base.soilMoisture = response.value;
        break;
      case 'LIGHT':
        base.light = response.value;
        break;
    }

    return base;
  }

  /**
   * Lấy dữ liệu tất cả 4 metric (TEMP, HUMIDITY, SOIL_MOISTURE, LIGHT) từ API,
   * merge chúng lại thành 1 list wide-format (dùng cho Radar chart hoặc 360 view).
   */
  getTelemetryHistoryMerged(deviceId: string, page = 0, size = 20): Observable<PageResponse<TelemetryData>> {
    const sensorTypes = ['TEMP', 'HUMIDITY', 'SOIL_MOISTURE', 'LIGHT'];
    const requests = sensorTypes.map((sensorType) =>
      this.api.get<PageResponse<TelemetryResponseSingle>>(`/api/telemetry/history/${deviceId}`, {
        params: { page, size, sensorType }
      })
    );

    return forkJoin(requests).pipe(
      map((responses) => {
        // Merge dữ liệu từ 4 API call
        const mergedMap = new Map<string, TelemetryData>();

        responses.forEach((response, index) => {
          const sensorType = sensorTypes[index];
          response.content.forEach((item) => {
            const key = `${item.id}`;
            if (!mergedMap.has(key)) {
              mergedMap.set(key, this.singleToWideFormat(item));
            } else {
              const existing = mergedMap.get(key)!;
              const converted = this.singleToWideFormat(item);
              existing.temperature = converted.temperature ?? existing.temperature;
              existing.humidity = converted.humidity ?? existing.humidity;
              existing.soilMoisture = converted.soilMoisture ?? existing.soilMoisture;
              existing.light = converted.light ?? existing.light;
            }
          });
        });

        const mergedContent = Array.from(mergedMap.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        return {
          content: mergedContent,
          number: page,
          size: size,
          totalElements: mergedContent.length,
          totalPages: Math.ceil(mergedContent.length / size),
          first: page === 0,
          last: page >= Math.ceil(mergedContent.length / size) - 1
        };
      })
    );
  }
}
