import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { UpdateUserRequest, UserResponse } from '../../core/models/user.models';
import { AuthStore } from '../../core/store/auth.store';
import { UserService } from '../../core/services/user.service';
import { extractApiErrorMessage } from '../../core/utils/http-error.util';

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './profile-page.component.html',
  styleUrl: './profile-page.component.scss'
})
export class ProfilePageComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly userService = inject(UserService);
  private readonly authStore = inject(AuthStore);

  protected readonly profile = signal<UserResponse | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly editMode = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly infoMessage = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    firstName: [''],
    lastName: [''],
    password: ['']
  });

  ngOnInit(): void {
    this.loadProfile();
  }

  protected loadProfile(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.userService
      .getMyInfo()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (user) => {
          this.profile.set(user);
          this.form.patchValue({
            firstName: user.firstName ?? '',
            lastName: user.lastName ?? '',
            password: ''
          });
        },
        error: (error: unknown) => {
          this.errorMessage.set(extractApiErrorMessage(error, 'Unable to load profile.'));
        }
      });
  }

  protected beginEdit(): void {
    this.editMode.set(true);
    this.errorMessage.set(null);
    this.infoMessage.set(null);
  }

  protected cancelEdit(): void {
    const currentProfile = this.profile();
    if (currentProfile) {
      this.form.patchValue({
        firstName: currentProfile.firstName ?? '',
        lastName: currentProfile.lastName ?? '',
        password: ''
      });
    }

    this.editMode.set(false);
  }

  protected saveProfile(): void {
    const currentProfile = this.profile();
    if (!currentProfile) {
      this.errorMessage.set('Profile not loaded yet.');
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);
    this.infoMessage.set(null);

    const rawValue = this.form.getRawValue();
    const payload: UpdateUserRequest = {
      firstName: this.normalizeOptionalValue(rawValue.firstName),
      lastName: this.normalizeOptionalValue(rawValue.lastName),
      password: this.normalizeOptionalValue(rawValue.password)
    };

    this.userService
      .updateUser(currentProfile.id, payload)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (updatedProfile) => {
          this.profile.set(updatedProfile);
          this.authStore.patchSession({
            firstName: updatedProfile.firstName ?? null,
            lastName: updatedProfile.lastName ?? null,
            role: updatedProfile.role
          });

          this.form.patchValue({
            firstName: updatedProfile.firstName ?? '',
            lastName: updatedProfile.lastName ?? '',
            password: ''
          });
          this.editMode.set(false);
          this.infoMessage.set('Profile updated successfully.');
        },
        error: (error: unknown) => {
          this.errorMessage.set(extractApiErrorMessage(error, 'Unable to update profile.'));
        }
      });
  }

  private normalizeOptionalValue(value: string): string | undefined {
    const trimmedValue = value.trim();
    return trimmedValue.length ? trimmedValue : undefined;
  }
}
