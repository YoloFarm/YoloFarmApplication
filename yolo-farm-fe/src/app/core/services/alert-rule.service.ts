import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AlertRuleRequest, AlertRuleResponse } from '../models/alert-rule.models';
import { ApiClientService } from './api-client.service';

@Injectable({ providedIn: 'root' })
export class AlertRuleService {
  private readonly api = inject(ApiClientService);

  createRule(payload: AlertRuleRequest): Observable<AlertRuleResponse> {
    return this.api.post<AlertRuleResponse, AlertRuleRequest>('/api/alerts/rules', payload);
  }

  getRulesByDevice(deviceId: string): Observable<AlertRuleResponse[]> {
    return this.api.get<AlertRuleResponse[]>(`/api/alerts/rules/${encodeURIComponent(deviceId)}`);
  }

  deleteRule(id: number): Observable<string> {
    return this.api.delete<string>(`/api/alerts/rules/${id}`);
  }
}
