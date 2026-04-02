import { Injectable, computed, signal } from '@angular/core';
import { AuthSession } from '../models/auth.models';

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private static readonly STORAGE_KEY = 'yolo_farm_session';

  readonly session = signal<AuthSession | null>(this.loadInitialSession());
  readonly isAuthenticated = computed(() => Boolean(this.session()?.token));
  readonly token = computed(() => this.session()?.token ?? null);
  readonly role = computed(() => this.session()?.role ?? null);

  setSession(session: AuthSession): void {
    this.session.set(session);

    if (this.canUseStorage()) {
      localStorage.setItem(AuthStore.STORAGE_KEY, JSON.stringify(session));
    }
  }

  patchSession(partial: Partial<AuthSession>): void {
    const currentSession = this.session();
    if (!currentSession) {
      return;
    }

    this.setSession({
      ...currentSession,
      ...partial
    });
  }

  clearSession(): void {
    this.session.set(null);

    if (this.canUseStorage()) {
      localStorage.removeItem(AuthStore.STORAGE_KEY);
    }
  }

  private loadInitialSession(): AuthSession | null {
    if (!this.canUseStorage()) {
      return null;
    }

    const rawValue = localStorage.getItem(AuthStore.STORAGE_KEY);
    if (!rawValue) {
      return null;
    }

    try {
      return JSON.parse(rawValue) as AuthSession;
    } catch {
      localStorage.removeItem(AuthStore.STORAGE_KEY);
      return null;
    }
  }

  private canUseStorage(): boolean {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
  }
}
