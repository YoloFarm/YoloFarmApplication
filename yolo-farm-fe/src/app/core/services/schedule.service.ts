import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ScheduleRequest, ScheduleResponse } from '../models/schedule.models';
import { ApiClientService } from './api-client.service';

@Injectable({ providedIn: 'root' })
export class ScheduleService {
  private readonly api = inject(ApiClientService);

  createSchedule(payload: ScheduleRequest): Observable<ScheduleResponse> {
    return this.api.post<ScheduleResponse, ScheduleRequest>('/api/schedules', payload);
  }

  getSchedulesByDevice(deviceId: string): Observable<ScheduleResponse[]> {
    return this.api.get<ScheduleResponse[]>(`/api/schedules/device/${encodeURIComponent(deviceId)}`);
  }

  updateSchedule(id: number, payload: ScheduleRequest): Observable<ScheduleResponse> {
    return this.api.put<ScheduleResponse, ScheduleRequest>(`/api/schedules/${id}`, payload);
  }

  deleteSchedule(id: number): Observable<string> {
    return this.api.delete<string>(`/api/schedules/${id}`);
  }
}
