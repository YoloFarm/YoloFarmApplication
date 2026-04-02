import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { APP_ENV } from '../config/app-env';
import { ApiResponse } from '../models/api.models';

type ApiParamValue = string | number | boolean | null | undefined;

type ApiRequestOptions = {
  params?: Record<string, ApiParamValue>;
};

@Injectable({ providedIn: 'root' })
export class ApiClientService {
  private readonly http = inject(HttpClient);

  get<T>(path: string, options?: ApiRequestOptions): Observable<T> {
    return this.unwrap<T>(
      this.http.get<ApiResponse<T>>(this.buildUrl(path), {
        params: this.toHttpParams(options?.params)
      })
    );
  }

  post<T, TBody = unknown>(path: string, body: TBody): Observable<T> {
    return this.unwrap<T>(this.http.post<ApiResponse<T>>(this.buildUrl(path), body));
  }

  put<T, TBody = unknown>(path: string, body: TBody): Observable<T> {
    return this.unwrap<T>(this.http.put<ApiResponse<T>>(this.buildUrl(path), body));
  }

  delete<T>(path: string): Observable<T> {
    return this.unwrap<T>(this.http.delete<ApiResponse<T>>(this.buildUrl(path)));
  }

  private unwrap<T>(request$: Observable<ApiResponse<T>>): Observable<T> {
    return request$.pipe(map((response) => response.result));
  }

  private buildUrl(path: string): string {
    return `${APP_ENV.apiBaseUrl}${path}`;
  }

  private toHttpParams(params?: Record<string, ApiParamValue>): HttpParams {
    let httpParams = new HttpParams();

    if (!params) {
      return httpParams;
    }

    Object.entries(params).forEach(([key, value]) => {
      if (value === null || value === undefined) {
        return;
      }

      httpParams = httpParams.set(key, String(value));
    });

    return httpParams;
  }
}
