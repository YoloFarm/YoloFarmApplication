import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { LoginRequest } from '../../core/models/auth.models';
import { AuthService } from '../../core/services/auth.service';
import { AuthStore } from '../../core/store/auth.store';
import { extractApiErrorMessage } from '../../core/utils/http-error.util';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.scss'
})
export class LoginPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly authStore = inject(AuthStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    email: ['admin@yolofarm.com', [Validators.required]],
    password: ['admin', [Validators.required]]
  });

  constructor() {
    if (this.authStore.isAuthenticated()) {
      void this.router.navigateByUrl('/dashboard');
    }
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    this.isSubmitting.set(true);

    const payload: LoginRequest = this.form.getRawValue();
    this.authService
      .login(payload)
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: (session) => {
          if (!session.authenticated) {
            this.errorMessage.set('Authentication failed. Please check your credentials.');
            return;
          }

          this.authStore.setSession(session);
          const redirect = this.route.snapshot.queryParamMap.get('redirect') ?? '/dashboard';
          void this.router.navigateByUrl(redirect);
        },
        error: (error: unknown) => {
          this.errorMessage.set(extractApiErrorMessage(error, 'Unable to sign in.'));
        }
      });
  }
}
