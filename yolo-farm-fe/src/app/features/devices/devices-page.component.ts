import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import {
  Device,
  DeviceComponent,
  DeviceComponentRequest,
  DeviceRequest
} from '../../core/models/device.models';
import { ControlService } from '../../core/services/control.service';
import { DeviceService } from '../../core/services/device.service';
import { AuthStore } from '../../core/store/auth.store';
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
  private readonly controlService = inject(ControlService);
  protected readonly authStore = inject(AuthStore);

  protected readonly devices = signal<Device[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly page = signal(0);
  protected readonly size = signal(10);
  protected readonly totalPages = signal(0);
  protected readonly totalElements = signal(0);
  protected readonly editingId = signal<number | null>(null);
  protected readonly editingComponentId = signal<number | null>(null);
  protected readonly selectedDevice = signal<Device | null>(null);
  protected readonly components = signal<DeviceComponent[]>([]);
  protected readonly componentsLoading = signal(false);
  protected readonly componentSaving = signal(false);
  protected readonly componentsErrorMessage = signal<string | null>(null);
  protected readonly componentsInfoMessage = signal<string | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly infoMessage = signal<string | null>(null);
  protected readonly isAdmin = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    deviceId: ['', Validators.required],
    name: ['', Validators.required]
  });

  protected readonly componentForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    codeName: ['', Validators.required]
  });

  ngOnInit(): void {
    this.isAdmin.set(this.authStore.role() === 'ADMIN');
    this.loadDevices(0);
  }

  protected loadDevices(page = this.page()): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    const request$ = this.isAdmin()
      ? this.deviceService.getDevices(page, this.size())
      : this.deviceService.getMyDevices(page, this.size());

    request$
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (response) => {
          this.devices.set(response.content);
          this.page.set(response.number);
          this.totalPages.set(response.totalPages);
          this.totalElements.set(response.totalElements);

          const selectedDevice = this.selectedDevice();
          if (!selectedDevice) {
            return;
          }

          const refreshedSelection = response.content.find((device) => device.id === selectedDevice.id);
          if (!refreshedSelection) {
            this.clearComponentSelection();
            return;
          }

          this.selectedDevice.set(refreshedSelection);
        },
        error: (error: unknown) => {
          this.errorMessage.set(extractApiErrorMessage(error, 'Unable to fetch devices.'));
        }
      });
  }

  protected submitForm(): void {
    if (!this.isAdmin()) {
      return;
    }

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
    if (!this.isAdmin()) {
      return;
    }

    this.editingId.set(device.id);
    this.form.setValue({
      deviceId: device.deviceId,
      name: device.name
    });
  }

  protected selectDevice(device: Device): void {
    this.selectedDevice.set(device);
    this.componentsInfoMessage.set(null);
    this.loadComponents(device.deviceId);
  }

  protected reloadSelectedDeviceComponents(): void {
    const selectedDevice = this.selectedDevice();
    if (!selectedDevice) {
      return;
    }

    this.loadComponents(selectedDevice.deviceId);
  }

  protected submitComponentForm(): void {
    if (!this.isAdmin()) {
      return;
    }

    const selectedDevice = this.selectedDevice();
    if (!selectedDevice) {
      this.componentsErrorMessage.set('Please select a device before creating a component.');
      return;
    }

    if (this.componentForm.invalid) {
      this.componentForm.markAllAsTouched();
      return;
    }

    this.componentSaving.set(true);
    this.componentsErrorMessage.set(null);
    this.componentsInfoMessage.set(null);

    const payload: DeviceComponentRequest = this.componentForm.getRawValue();

    const componentId = this.editingComponentId();
    const request$ = componentId
      ? this.deviceService.updateComponent(componentId, payload)
      : this.deviceService.createComponent(selectedDevice.deviceId, payload);

    request$
      .pipe(finalize(() => this.componentSaving.set(false)))
      .subscribe({
        next: () => {
          this.componentsInfoMessage.set(
            componentId ? 'Component updated successfully.' : 'Component created successfully.'
          );
          this.resetComponentForm();
          this.loadComponents(selectedDevice.deviceId);
        },
        error: (error: unknown) => {
          this.componentsErrorMessage.set(
            extractApiErrorMessage(error, 'Unable to save device component.')
          );
        }
      });
  }

  protected editComponent(component: DeviceComponent): void {
    if (!this.isAdmin()) {
      return;
    }

    this.editingComponentId.set(component.id);
    this.componentsInfoMessage.set(null);
    this.componentsErrorMessage.set(null);
    this.componentForm.setValue({
      name: component.name,
      codeName: component.codeName
    });
  }

  protected deleteComponent(component: DeviceComponent): void {
    if (!this.isAdmin()) {
      return;
    }

    const confirmed = window.confirm(`Delete component ${component.name} (${component.codeName})?`);
    if (!confirmed) {
      return;
    }

    const selectedDevice = this.selectedDevice();
    this.componentsErrorMessage.set(null);
    this.componentsInfoMessage.set(null);

    this.deviceService.deleteComponent(component.id).subscribe({
      next: () => {
        this.componentsInfoMessage.set('Component deleted successfully.');
        if (this.editingComponentId() === component.id) {
          this.resetComponentForm();
        }

        if (selectedDevice) {
          this.loadComponents(selectedDevice.deviceId);
        }
      },
      error: (error: unknown) => {
        this.componentsErrorMessage.set(
          extractApiErrorMessage(error, 'Unable to delete device component.')
        );
      }
    });
  }

  protected deleteDevice(device: Device): void {
    if (!this.isAdmin()) {
      return;
    }

    const confirmed = window.confirm(`Delete device ${device.name} (${device.deviceId})?`);
    if (!confirmed) {
      return;
    }

    const deletingSelectedDevice = this.selectedDevice()?.id === device.id;

    this.errorMessage.set(null);
    this.infoMessage.set(null);

    this.deviceService.deleteDevice(device.id).subscribe({
      next: () => {
        this.infoMessage.set('Device deleted successfully.');

        if (deletingSelectedDevice) {
          this.clearComponentSelection();
        }

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

  protected resetComponentForm(): void {
    this.editingComponentId.set(null);
    this.componentForm.reset({ name: '', codeName: '' });
  }

  protected componentType(component: DeviceComponent): 'FAN' | 'PUMP' | 'LED' | 'UNKNOWN' {
    const token = `${component.codeName} ${component.name}`.toUpperCase();

    if (token.includes('FAN')) {
      return 'FAN';
    }

    if (token.includes('PUMP')) {
      return 'PUMP';
    }

    if (token.includes('LED')) {
      return 'LED';
    }

    return 'UNKNOWN';
  }

  protected formatComponentStatus(component: DeviceComponent): string {
    const type = this.componentType(component);

    if (type === 'FAN' || type === 'PUMP') {
      return `${this.getPowerValue(component)}%`;
    }

    return component.status || '--';
  }

  protected isComponentActive(component: DeviceComponent): boolean {
    const type = this.componentType(component);

    if (type === 'LED') {
      return this.isLedOn(component);
    }

    if (type === 'FAN' || type === 'PUMP') {
      return this.getPowerValue(component) > 0;
    }

    return component.status === 'ON';
  }

  protected isLedOn(component: DeviceComponent): boolean {
    return (component.status || '').toUpperCase() === 'ON';
  }

  protected getPowerValue(component: DeviceComponent): number {
    return this.parsePowerValue(component.status);
  }

  protected onPowerChange(component: DeviceComponent, event: Event): void {
    const rawValue = (event.target as HTMLInputElement).value;
    const nextValue = this.parsePowerValue(rawValue);

    this.updateComponentStatus(component.id, String(nextValue));
    this.sendComponentCommand(component, String(nextValue));
  }

  protected onPowerInput(component: DeviceComponent, event: Event): void {
    const rawValue = (event.target as HTMLInputElement).value;
    const nextValue = this.parsePowerValue(rawValue);

    this.updateComponentStatus(component.id, String(nextValue));
  }

  protected onLedToggle(component: DeviceComponent, event: Event): void {
    const nextStatus = (event.target as HTMLInputElement).checked ? 'ON' : 'OFF';
    const previousStatus = component.status;

    this.updateComponentStatus(component.id, nextStatus);
    this.sendComponentCommand(component, nextStatus, previousStatus);
  }

  protected fanSpinDuration(component: DeviceComponent): string {
    const power = this.getPowerValue(component);
    const duration = 3 - power * 0.02;
    return `${Math.max(0.8, duration).toFixed(2)}s`;
  }

  protected pumpPulseDuration(component: DeviceComponent): string {
    const power = this.getPowerValue(component);
    const duration = 2.4 - power * 0.015;
    return `${Math.max(0.6, duration).toFixed(2)}s`;
  }

  private loadComponents(deviceId: string): void {
    this.componentsLoading.set(true);
    this.componentsErrorMessage.set(null);

    this.deviceService
      .getComponentsByDeviceId(deviceId)
      .pipe(finalize(() => this.componentsLoading.set(false)))
      .subscribe({
        next: (components) => {
          this.components.set(components);
        },
        error: (error: unknown) => {
          this.components.set([]);
          this.componentsErrorMessage.set(
            extractApiErrorMessage(error, 'Unable to fetch device components.')
          );
        }
      });
  }

  private clearComponentSelection(): void {
    this.selectedDevice.set(null);
    this.components.set([]);
    this.componentsErrorMessage.set(null);
    this.componentsInfoMessage.set(null);
    this.resetComponentForm();
  }

  private sendComponentCommand(
    component: DeviceComponent,
    action: string,
    previousStatus?: string
  ): void {
    const deviceId = component.deviceId || this.selectedDevice()?.deviceId;

    if (!deviceId) {
      this.componentsErrorMessage.set('Missing device identifier for the selected component.');
      if (previousStatus !== undefined) {
        this.updateComponentStatus(component.id, previousStatus);
      }
      return;
    }

    this.componentsErrorMessage.set(null);

    this.controlService
      .sendCommand({ deviceId, command: component.codeName, action })
      .subscribe({
        error: (error: unknown) => {
          this.componentsErrorMessage.set(
            extractApiErrorMessage(error, 'Unable to update device component.')
          );
          if (previousStatus !== undefined) {
            this.updateComponentStatus(component.id, previousStatus);
          }
        }
      });
  }

  private updateComponentStatus(componentId: number, status: string): void {
    this.components.update((items) =>
      items.map((component) =>
        component.id === componentId ? { ...component, status } : component
      )
    );
  }

  private parsePowerValue(raw: string | number | null | undefined): number {
    if (raw === null || raw === undefined) {
      return 0;
    }

    const value = typeof raw === 'number' ? raw : Number.parseInt(raw, 10);
    if (Number.isNaN(value)) {
      return 0;
    }

    return Math.min(100, Math.max(0, value));
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
