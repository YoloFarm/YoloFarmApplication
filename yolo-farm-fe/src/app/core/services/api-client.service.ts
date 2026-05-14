import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiResponse } from '../models/api.models';
import { environment } from '../../../environments/environment';

type ApiParamValue = string | number | boolean | null | undefined;

type ApiRequestOptions = {
  params?: Record<string, ApiParamValue>;
};

@Injectable({ providedIn: 'root' })
export class ApiClientService {
  private readonly http = inject(HttpClient);

  get<T>(path: string, options?: ApiRequestOptions): Observable<T> {
    return this.unwrap<T>(
      this.http.get<ApiResponse<T> | T>(this.buildUrl(path), {
        params: this.toHttpParams(options?.params)
      })
    );
  }

  post<T, TBody = unknown>(path: string, body: TBody): Observable<T> {
    return this.unwrap<T>(this.http.post<ApiResponse<T> | T>(this.buildUrl(path), body));
  }

  put<T, TBody = unknown>(path: string, body: TBody): Observable<T> {
    return this.unwrap<T>(this.http.put<ApiResponse<T> | T>(this.buildUrl(path), body));
  }

  deleteText(path: string): Observable<void> {
    return this.http.delete(this.buildUrl(path), { responseType: 'text' }).pipe(map(() => undefined));
  }

  delete<T>(path: string): Observable<T> {
    return this.unwrap<T>(this.http.delete<ApiResponse<T> | T>(this.buildUrl(path)));
  }

  private unwrap<T>(request$: Observable<ApiResponse<T> | T>): Observable<T> {
    return request$.pipe(
      map((response) => (this.isApiResponse(response) ? response.result : response))
    );
  }

  private isApiResponse<T>(response: ApiResponse<T> | T): response is ApiResponse<T> {
    return typeof response === 'object' && response !== null && 'result' in response;
  }

  private buildUrl(path: string): string {
    return `${environment.apiBaseUrl}${path}`;
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
