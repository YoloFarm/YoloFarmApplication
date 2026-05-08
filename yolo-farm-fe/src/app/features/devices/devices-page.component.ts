import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
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
export class DevicesPageComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly deviceService = inject(DeviceService);
  private readonly controlService = inject(ControlService);
  protected readonly authStore = inject(AuthStore);
  private readonly pumpTimers = new Map<number, ReturnType<typeof setInterval>>();
  private readonly maxPumpSeconds = 24 * 60 * 60 - 1;
  private readonly pumpStorageKey = 'yolo-farm:pump-countdowns';
  protected readonly pumpHourOptions = Array.from({ length: 24 }, (_, index) => index);
  protected readonly pumpMinuteOptions = Array.from({ length: 60 }, (_, index) => index);
  protected readonly pumpSecondOptions = Array.from({ length: 60 }, (_, index) => index);

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
  protected readonly pumpInputs = signal<Record<number, number>>({});
  protected readonly pumpCountdowns = signal<Record<number, number>>({});

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
    setInterval(() => {
        this.loadComponents(this.selectedDevice()?.deviceId || '');
    }, 30000);
  }

  ngOnDestroy(): void {
    this.clearVisiblePumpState();
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

    if (type === 'FAN') {
      return `${this.getPowerValue(component)}%`;
    }

    if (type === 'PUMP') {
      const remaining = this.getPumpRemainingSeconds(component);
      return remaining > 0 ? `Đang đếm ngược: ${this.formatDuration(remaining)}` : 'Chưa chạy';
    }

    return component.status || '--';
  }

  protected isComponentActive(component: DeviceComponent): boolean {
    const type = this.componentType(component);

    if (type === 'LED') {
      return this.isLedOn(component);
    }

    if (type === 'FAN') {
      return this.getPowerValue(component) > 0;
    }

    if (type === 'PUMP') {
      return this.getPumpRemainingSeconds(component) > 0;
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
    return this.isPumpRunning(component) ? '1.2s' : '2.8s';
  }

  protected isPumpRunning(component: DeviceComponent): boolean {
    return this.getPumpRemainingSeconds(component) > 0;
  }

  protected getPumpInputSeconds(component: DeviceComponent): number {
    return this.pumpInputs()[component.id] ?? 0;
  }

  protected getPumpHours(component: DeviceComponent): number {
    return this.breakPumpSeconds(this.getPumpInputSeconds(component)).hours;
  }

  protected getPumpMinutes(component: DeviceComponent): number {
    return this.breakPumpSeconds(this.getPumpInputSeconds(component)).minutes;
  }

  protected getPumpSeconds(component: DeviceComponent): number {
    return this.breakPumpSeconds(this.getPumpInputSeconds(component)).seconds;
  }

  protected formatPumpCountdown(component: DeviceComponent): string {
    return this.formatDuration(this.getPumpRemainingSeconds(component));
  }

  protected onPumpTimePartChange(component: DeviceComponent, part: 'hours' | 'minutes' | 'seconds', event: Event): void {
    const input = event.target as HTMLInputElement;
    const rawValue = Number.parseInt(input.value, 10);
    const nextValue = Number.isNaN(rawValue) ? 0 : rawValue;
    const current = this.breakPumpSeconds(this.getPumpInputSeconds(component));
    const nextDraft = {
      hours: part === 'hours' ? nextValue : current.hours,
      minutes: part === 'minutes' ? nextValue : current.minutes,
      seconds: part === 'seconds' ? nextValue : current.seconds
    };

    this.setPumpInput(component.id, this.composePumpSeconds(nextDraft.hours, nextDraft.minutes, nextDraft.seconds));
  }

  protected startPumpTimer(component: DeviceComponent): void {
    const durationSeconds = this.getPumpInputSeconds(component);
    if (durationSeconds <= 0) {
      this.componentsErrorMessage.set('Please choose a pump duration greater than 0 seconds.');
      return;
    }

    const previousCountdown = this.getPumpRemainingSeconds(component);
    const previousInput = this.getPumpInputSeconds(component);
    const previousStatus = component.status;
    const endAt = Date.now() + durationSeconds * 1000;

    this.componentsErrorMessage.set(null);
    this.setPumpCountdown(component.id, durationSeconds);
    this.persistPumpCountdown(component.id, endAt);
    this.runPumpTimer(component.id, endAt);

    this.sendComponentCommand(component, String(durationSeconds), previousStatus, undefined, () => {
      this.restorePumpCountdown(component.id, previousInput, previousCountdown);
    });
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
          this.restorePumpState(components);
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
    this.clearVisiblePumpState();
  }

  private sendComponentCommand(
    component: DeviceComponent,
    action: string,
    previousStatus?: string,
    onSuccess?: () => void,
    onFailure?: () => void
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
        next: () => {
          onSuccess?.();
        },
        error: (error: unknown) => {
          this.componentsErrorMessage.set(
            extractApiErrorMessage(error, 'Unable to update device component.')
          );
          if (previousStatus !== undefined) {
            this.updateComponentStatus(component.id, previousStatus);
          }
          onFailure?.();
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

  private getPumpRemainingSeconds(component: DeviceComponent): number {
    return this.pumpCountdowns()[component.id] ?? 0;
  }

  private parsePumpSeconds(raw: string | number | null | undefined): number {
    if (raw === null || raw === undefined) {
      return 0;
    }

    const value = typeof raw === 'number' ? raw : Number.parseInt(raw, 10);
    if (Number.isNaN(value)) {
      return 0;
    }

    return this.normalizePumpSeconds(value);
  }

  private breakPumpSeconds(totalSeconds: number): { hours: number; minutes: number; seconds: number } {
    const normalized = this.normalizePumpSeconds(totalSeconds);
    const hours = Math.floor(normalized / 3600);
    const minutes = Math.floor((normalized % 3600) / 60);
    const seconds = normalized % 60;

    return { hours, minutes, seconds };
  }

  private composePumpSeconds(hours: number, minutes: number, seconds: number): number {
    return this.normalizePumpSeconds(hours * 3600 + minutes * 60 + seconds);
  }

  private normalizePumpSeconds(value: number): number {
    const safeValue = Math.max(0, Math.floor(value));
    return Math.min(this.maxPumpSeconds, safeValue);
  }

  private runPumpTimer(componentId: number, endAt: number): void {
    this.clearPumpTimer(componentId);

    const tick = () => {
      const remainingSeconds = this.getRemainingSeconds(endAt);

      if (remainingSeconds <= 0) {
        this.setPumpCountdown(componentId, 0);
        this.setPumpInput(componentId, 0);
        this.clearPumpCountdown(componentId);
        this.clearPumpTimer(componentId);
        return;
      }

      this.setPumpCountdown(componentId, remainingSeconds);
      this.setPumpInput(componentId, remainingSeconds);
    };

    tick();

    const timer = setInterval(tick, 1000);
    this.pumpTimers.set(componentId, timer);
  }

  private restorePumpCountdown(componentId: number, inputSeconds: number, countdownSeconds: number): void {
    if (countdownSeconds <= 0) {
      this.setPumpCountdown(componentId, 0);
      this.setPumpInput(componentId, inputSeconds);
      this.clearPumpCountdown(componentId);
      this.clearPumpTimer(componentId);
      return;
    }

    const endAt = Date.now() + countdownSeconds * 1000;
    this.setPumpCountdown(componentId, countdownSeconds);
    this.setPumpInput(componentId, inputSeconds);
    this.persistPumpCountdown(componentId, endAt);
    this.runPumpTimer(componentId, endAt);
  }

  private setPumpInput(componentId: number, seconds: number): void {
    this.pumpInputs.update((state) => ({
      ...state,
      [componentId]: this.normalizePumpSeconds(seconds)
    }));
  }

  private setPumpCountdown(componentId: number, seconds: number): void {
    this.pumpCountdowns.update((state) => ({
      ...state,
      [componentId]: this.normalizePumpSeconds(seconds)
    }));
  }

  private clearPumpTimer(componentId: number): void {
    const timer = this.pumpTimers.get(componentId);
    if (!timer) {
      return;
    }

    clearInterval(timer);
    this.pumpTimers.delete(componentId);
  }

  private clearAllPumpTimers(): void {
    this.pumpTimers.forEach((timer) => clearInterval(timer));
    this.pumpTimers.clear();
  }

  private clearVisiblePumpState(): void {
    this.clearAllPumpTimers();
    this.pumpCountdowns.set({});
    this.pumpInputs.set({});
  }

  private restorePumpState(components: DeviceComponent[]): void {
    const sessions = this.readPumpSessions();
    const pumpIds = new Set(
      components.filter((component) => this.componentType(component) === 'PUMP').map((component) => component.id)
    );

    this.pumpTimers.forEach((timer, componentId) => {
      if (!pumpIds.has(componentId)) {
        clearInterval(timer);
        this.pumpTimers.delete(componentId);
      }
    });

    this.pumpInputs.set({});
    this.pumpCountdowns.set({});

    components
      .filter((component) => this.componentType(component) === 'PUMP')
      .forEach((component) => {
        const endAt = sessions[component.id];
        if (!endAt) {
          return;
        }

        const remainingSeconds = this.getRemainingSeconds(endAt);
        if (remainingSeconds <= 0) {
          this.clearPumpCountdown(component.id);
          return;
        }

        this.setPumpCountdown(component.id, remainingSeconds);
        this.setPumpInput(component.id, remainingSeconds);
        this.runPumpTimer(component.id, endAt);
      });
  }

  private readPumpSessions(): Record<number, number> {
    if (!this.canUseLocalStorage()) {
      return {};
    }

    try {
      const rawValue = localStorage.getItem(this.pumpStorageKey);
      if (!rawValue) {
        return {};
      }

      const parsed = JSON.parse(rawValue) as Record<string, number>;
      return Object.entries(parsed).reduce<Record<number, number>>((accumulator, [id, endAt]) => {
        const componentId = Number.parseInt(id, 10);
        if (!Number.isNaN(componentId) && typeof endAt === 'number') {
          accumulator[componentId] = endAt;
        }
        return accumulator;
      }, {});
    } catch {
      return {};
    }
  }

  private persistPumpCountdown(componentId: number, endAt: number): void {
    if (!this.canUseLocalStorage()) {
      return;
    }

    const sessions = this.readPumpSessions();
    sessions[componentId] = endAt;
    localStorage.setItem(this.pumpStorageKey, JSON.stringify(sessions));
  }

  private clearPumpCountdown(componentId: number): void {
    if (!this.canUseLocalStorage()) {
      return;
    }

    const sessions = this.readPumpSessions();
    if (!(componentId in sessions)) {
      return;
    }

    delete sessions[componentId];
    localStorage.setItem(this.pumpStorageKey, JSON.stringify(sessions));
  }

  private getRemainingSeconds(endAt: number): number {
    return Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
  }

  private canUseLocalStorage(): boolean {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
  }

  private formatTimeInput(seconds: number): string {
    const normalized = this.normalizePumpSeconds(seconds);
    const hours = Math.floor(normalized / 3600);
    const minutes = Math.floor((normalized % 3600) / 60);
    const remainingSeconds = normalized % 60;

    return `${this.padTime(hours)}:${this.padTime(minutes)}:${this.padTime(remainingSeconds)}`;
  }

  private formatDuration(totalSeconds: number): string {
    const normalized = this.normalizePumpSeconds(totalSeconds);
    const hours = Math.floor(normalized / 3600);
    const minutes = Math.floor((normalized % 3600) / 60);
    const seconds = normalized % 60;

    if (hours > 0) {
      return `${hours}:${this.padTime(minutes)}:${this.padTime(seconds)}`;
    }

    return `${this.padTime(minutes)}:${this.padTime(seconds)}`;
  }

  protected padTime(value: number): string {
    return value.toString().padStart(2, '0');
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
