import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ControlRequest, ControlResponse } from '../models/control.models';
import { ApiClientService } from './api-client.service';

@Injectable({ providedIn: 'root' })
export class ControlService {
  private readonly api = inject(ApiClientService);

  sendCommand(payload: ControlRequest): Observable<ControlResponse> {
    return this.api.post<ControlResponse, ControlRequest>('/api/control', payload);
  }
}
