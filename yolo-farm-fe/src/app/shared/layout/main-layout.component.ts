import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { catchError, of } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { AuthStore } from '../../core/store/auth.store';

interface NavItem {
  label: string;
  path: string;
  adminOnly?: boolean;
}

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss'
})
export class MainLayoutComponent {
  protected readonly authStore = inject(AuthStore);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  private readonly navItems: NavItem[] = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Devices', path: '/devices' },
    { label: 'Telemetry', path: '/telemetry' },
    { label: 'Profile', path: '/profile' },
    { label: 'Users', path: '/users', adminOnly: true }
  ];

  protected readonly visibleNavItems = computed(() =>
    this.navItems.filter((item) => !item.adminOnly || this.authStore.role() === 'ADMIN')
  );

  protected readonly userLabel = computed(() => {
    const session = this.authStore.session();
    if (!session) {
      return 'Guest';
    }

    const fullName = `${session.firstName ?? ''} ${session.lastName ?? ''}`.trim();
    return fullName || session.username;
  });

  protected logout(): void {
    const token = this.authStore.token();
    const completeLogout = () => {
      this.authStore.clearSession();
      void this.router.navigate(['/login']);
    };

    if (!token) {
      completeLogout();
      return;
    }

    this.authService
      .logout(token)
      .pipe(catchError(() => of('logged-out')))
      .subscribe(() => completeLogout());
  }
}
