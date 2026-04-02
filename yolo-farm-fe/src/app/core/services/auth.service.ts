import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  AuthSession,
  IntrospectResponse,
  LoginRequest,
  TokenRequest
} from '../models/auth.models';
import { ApiClientService } from './api-client.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiClientService);

  login(payload: LoginRequest): Observable<AuthSession> {
    return this.api.post<AuthSession, LoginRequest>('/api/auth/login', payload);
  }

  logout(token: string): Observable<string> {
    return this.api.post<string, TokenRequest>('/api/auth/logout', { token });
  }

  refreshToken(token: string): Observable<AuthSession> {
    return this.api.post<AuthSession, TokenRequest>('/api/auth/refresh', { token });
  }

  introspect(token: string): Observable<boolean> {
    return this.api
      .post<IntrospectResponse, TokenRequest>('/api/auth/introspect', { token })
      .pipe(map((response) => response.valid));
  }
}
