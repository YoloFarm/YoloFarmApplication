import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { UserRole } from '../../core/models/auth.models';
import {
  CreateUserRequest,
  UpdateUserRequest,
  UserResponse
} from '../../core/models/user.models';
import { UserService } from '../../core/services/user.service';
import { extractApiErrorMessage } from '../../core/utils/http-error.util';

@Component({
  selector: 'app-users-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './users-page.component.html',
  styleUrl: './users-page.component.scss'
})
export class UsersPageComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly userService = inject(UserService);

  protected readonly users = signal<UserResponse[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly page = signal(0);
  protected readonly size = signal(10);
  protected readonly totalPages = signal(0);
  protected readonly totalElements = signal(0);
  protected readonly editingUserId = signal<string | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly infoMessage = signal<string | null>(null);
  protected readonly roleOptions: UserRole[] = ['USER', 'ADMIN'];

  protected readonly isEditing = computed(() => Boolean(this.editingUserId()));

  protected readonly form = this.fb.nonNullable.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    firstName: [''],
    lastName: [''],
    role: ['USER' as UserRole, Validators.required],
    password: ['', [Validators.required, Validators.minLength(3)]]
  });

  ngOnInit(): void {
    this.enterCreateMode();
    this.loadUsers(0);
  }

  protected loadUsers(page = this.page()): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.userService
      .getUsers(page, this.size())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (response) => {
          this.users.set(response.content);
          this.page.set(response.number);
          this.totalPages.set(response.totalPages);
          this.totalElements.set(response.totalElements);
        },
        error: (error: unknown) => {
          this.errorMessage.set(extractApiErrorMessage(error, 'Unable to load users.'));
        }
      });
  }

  protected submitForm(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);
    this.infoMessage.set(null);

    const rawValue = this.form.getRawValue();
    const editingUserId = this.editingUserId();

    if (editingUserId) {
      const payload: UpdateUserRequest = {
        firstName: this.normalizeOptionalValue(rawValue.firstName),
        lastName: this.normalizeOptionalValue(rawValue.lastName),
        role: rawValue.role,
        password: this.normalizeOptionalValue(rawValue.password)
      };

      this.userService
        .updateUser(editingUserId, payload)
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: () => {
            this.infoMessage.set('User updated successfully.');
            this.enterCreateMode();
            this.loadUsers(this.page());
          },
          error: (error: unknown) => {
            this.errorMessage.set(extractApiErrorMessage(error, 'Unable to update user.'));
          }
        });

      return;
    }

    const password = this.normalizeOptionalValue(rawValue.password);
    if (!password) {
      this.saving.set(false);
      this.errorMessage.set('Password is required for creating a user.');
      this.form.controls.password.setErrors({ required: true });
      return;
    }

    const payload: CreateUserRequest = {
      username: rawValue.username.trim(),
      password,
      firstName: this.normalizeOptionalValue(rawValue.firstName),
      lastName: this.normalizeOptionalValue(rawValue.lastName),
      role: rawValue.role
    };

    this.userService
      .createUser(payload)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.infoMessage.set('User created successfully.');
          this.enterCreateMode();
          this.loadUsers(0);
        },
        error: (error: unknown) => {
          this.errorMessage.set(extractApiErrorMessage(error, 'Unable to create user.'));
        }
      });
  }

  protected startEdit(user: UserResponse): void {
    this.editingUserId.set(user.id);

    this.form.controls.username.enable();
    this.form.controls.username.setValue(user.username);
    this.form.controls.username.disable();

    this.form.patchValue({
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      role: user.role,
      password: ''
    });

    this.form.controls.password.clearValidators();
    this.form.controls.password.updateValueAndValidity();
    this.infoMessage.set(`Editing ${user.username}`);
    this.errorMessage.set(null);
  }

  protected deleteUser(user: UserResponse): void {
    const confirmed = window.confirm(`Delete user ${user.username}?`);
    if (!confirmed) {
      return;
    }

    this.errorMessage.set(null);
    this.infoMessage.set(null);

    this.userService.deleteUser(user.id).subscribe({
      next: () => {
        this.infoMessage.set('User deleted successfully.');
        this.loadUsers(this.page());
      },
      error: (error: unknown) => {
        this.errorMessage.set(extractApiErrorMessage(error, 'Unable to delete user.'));
      }
    });
  }

  protected cancelEdit(): void {
    this.enterCreateMode();
  }

  protected nextPage(): void {
    if (this.page() + 1 >= this.totalPages()) {
      return;
    }

    this.loadUsers(this.page() + 1);
  }

  protected previousPage(): void {
    if (this.page() === 0) {
      return;
    }

    this.loadUsers(this.page() - 1);
  }

  private enterCreateMode(): void {
    this.editingUserId.set(null);
    this.form.reset({
      username: '',
      firstName: '',
      lastName: '',
      role: 'USER',
      password: ''
    });

    this.form.controls.username.enable();
    this.form.controls.password.setValidators([Validators.required, Validators.minLength(3)]);
    this.form.controls.password.updateValueAndValidity();
  }

  private normalizeOptionalValue(value: string): string | undefined {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  }
}
