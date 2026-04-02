import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { Device, DeviceRequest } from '../../core/models/device.models';
import { DeviceService } from '../../core/services/device.service';
import { extractApiErrorMessage } from '../../core/utils/http-error.util';

@Component({
  selector: 'app-devices-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './devices-page.component.html',
  styleUrl: './devices-page.component.scss'
})
export class DevicesPageComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly deviceService = inject(DeviceService);

  protected readonly devices = signal<Device[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly page = signal(0);
  protected readonly size = signal(10);
  protected readonly totalPages = signal(0);
  protected readonly totalElements = signal(0);
  protected readonly editingId = signal<number | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly infoMessage = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    deviceId: ['', Validators.required],
    name: ['', Validators.required]
  });

  ngOnInit(): void {
    this.loadDevices(0);
  }

  protected loadDevices(page = this.page()): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.deviceService
      .getDevices(page, this.size())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (response) => {
          this.devices.set(response.content);
          this.page.set(response.number);
          this.totalPages.set(response.totalPages);
          this.totalElements.set(response.totalElements);
        },
        error: (error: unknown) => {
          this.errorMessage.set(extractApiErrorMessage(error, 'Unable to fetch devices.'));
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

    const payload: DeviceRequest = this.form.getRawValue();
    const deviceId = this.editingId();

    const request$ = deviceId
      ? this.deviceService.updateDevice(deviceId, payload)
      : this.deviceService.createDevice(payload);

    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.infoMessage.set(deviceId ? 'Device updated successfully.' : 'Device created successfully.');
        this.cancelEdit();
        this.loadDevices(deviceId ? this.page() : 0);
      },
      error: (error: unknown) => {
        this.errorMessage.set(extractApiErrorMessage(error, 'Unable to save device.'));
      }
    });
  }

  protected editDevice(device: Device): void {
    this.editingId.set(device.id);
    this.form.setValue({
      deviceId: device.deviceId,
      name: device.name
    });
  }

  protected deleteDevice(device: Device): void {
    const confirmed = window.confirm(`Delete device ${device.name} (${device.deviceId})?`);
    if (!confirmed) {
      return;
    }

    this.errorMessage.set(null);
    this.infoMessage.set(null);

    this.deviceService.deleteDevice(device.id).subscribe({
      next: () => {
        this.infoMessage.set('Device deleted successfully.');
        this.loadDevices(this.page());
      },
      error: (error: unknown) => {
        this.errorMessage.set(extractApiErrorMessage(error, 'Unable to delete device.'));
      }
    });
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
    this.form.reset({ deviceId: '', name: '' });
  }

  protected nextPage(): void {
    if (this.page() + 1 >= this.totalPages()) {
      return;
    }

    this.loadDevices(this.page() + 1);
  }

  protected previousPage(): void {
    if (this.page() === 0) {
      return;
    }

    this.loadDevices(this.page() - 1);
  }
}
