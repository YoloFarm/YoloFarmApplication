import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { ReplaySubject, catchError, finalize, switchMap, take, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { AuthStore } from '../store/auth.store';

let refreshInProgress = false;
let refreshSubject = new ReplaySubject<string>(1);

function isAuthEndpoint(url: string): boolean {
  return url.includes('/api/auth/');
}

function withBearerToken(request: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return request.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  });
}

export const authRefreshInterceptor: HttpInterceptorFn = (request, next) => {
  const authStore = inject(AuthStore);
  const authService = inject(AuthService);
  const router = inject(Router);

  return next(request).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) {
        return throwError(() => error);
      }

      const token = authStore.token();
      const shouldRefresh = error.status === 401 && Boolean(token) && !isAuthEndpoint(request.url);

      if (!shouldRefresh || !token) {
        return throwError(() => error);
      }

      if (!refreshInProgress) {
        refreshInProgress = true;
        refreshSubject = new ReplaySubject<string>(1);

        return authService.refreshToken(token).pipe(
          switchMap((session) => {
            authStore.setSession(session);
            refreshSubject.next(session.token);
            refreshSubject.complete();
            return next(withBearerToken(request, session.token));
          }),
          catchError((refreshError: unknown) => {
            authStore.clearSession();
            void router.navigate(['/login']);
            refreshSubject.error(refreshError);
            return throwError(() => refreshError);
          }),
          finalize(() => {
            refreshInProgress = false;
          })
        );
      }

      return refreshSubject.pipe(
        take(1),
        switchMap((newToken) => next(withBearerToken(request, newToken)))
      );
    })
  );
};
