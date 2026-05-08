import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, finalize, forkJoin, map, of, switchMap } from 'rxjs';
import { ControlService } from '../../core/services/control.service';
import { DeviceService } from '../../core/services/device.service';
import { TelemetryService } from '../../core/services/telemetry.service';
import { Device, DeviceComponent } from '../../core/models/device.models';
import { LatestTelemetry } from '../../core/models/telemetry.models';
import { AuthStore } from '../../core/store/auth.store';
import { extractApiErrorMessage } from '../../core/utils/http-error.util';

interface DeviceSnapshot {
  device: Device;
  telemetry: LatestTelemetry | null;
}

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './dashboard-page.component.html',
  styleUrl: './dashboard-page.component.scss'
})
export class DashboardPageComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authStore = inject(AuthStore);
  private readonly deviceService = inject(DeviceService);
  private readonly telemetryService = inject(TelemetryService);
  private readonly controlService = inject(ControlService);

  protected readonly devices = signal<Device[]>([]);
  protected readonly controlComponents = signal<DeviceComponent[]>([]);
  protected readonly snapshots = signal<DeviceSnapshot[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly isLoadingComponents = signal(false);
  protected readonly isSendingCommand = signal(false);
  protected readonly isClaimingDevice = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly commandFeedback = signal<string | null>(null);
  protected readonly claimFeedback = signal<string | null>(null);

  protected readonly actionOptions = ['ON', 'OFF'];

  protected readonly controlForm = this.fb.nonNullable.group({
    deviceId: ['', Validators.required],
    command: ['', Validators.required],
    action: ['ON', Validators.required]
  });

  protected readonly claimForm = this.fb.nonNullable.group({
    deviceId: ['', Validators.required]
  });

  protected readonly onlineCount = computed(
    () => this.devices().filter((device) => device.status === 'ONLINE').length
  );

  protected readonly offlineCount = computed(
    () => this.devices().filter((device) => device.status !== 'ONLINE').length
  );

  protected readonly hasDevices = computed(() => this.devices().length > 0);
  protected readonly hasControlComponents = computed(() => this.controlComponents().length > 0);

  ngOnInit(): void {
    this.refreshDashboard();
  }

  protected refreshDashboard(): void {
    this.errorMessage.set(null);
    this.isLoading.set(true);

    const devicesRequest$ =
      this.authStore.role() === 'ADMIN'
        ? this.deviceService.getDevices(0, 50)
        : this.deviceService.getMyDevices(0, 50);

    devicesRequest$
      .pipe(
        switchMap((pageData) => {
          const devices = pageData.content;
          this.devices.set(devices);

          if (!devices.length) {
            this.snapshots.set([]);
            this.controlForm.patchValue({ deviceId: '' });
            return of([] as DeviceSnapshot[]);
          }

          const currentDeviceId = this.controlForm.controls.deviceId.value;
          if (!currentDeviceId) {
            this.controlForm.patchValue({ deviceId: devices[0].deviceId });
            this.loadControlComponents(devices[0].deviceId);
          } else {
            this.loadControlComponents(currentDeviceId);
          }

          const latestRequests = devices.map((device) =>
            this.telemetryService.getLatestTelemetry(device.deviceId).pipe(
              map((telemetry) => ({ device, telemetry })),
              catchError(() => of({ device, telemetry: null }))
            )
          );

          return forkJoin(latestRequests);
        }),
        finalize(() => this.isLoading.set(false))
      )
      .subscribe({
        next: (snapshots) => {
          this.snapshots.set(snapshots);
        },
        error: (error: unknown) => {
          this.errorMessage.set(extractApiErrorMessage(error, 'Unable to load dashboard data.'));
        }
      });
  }

  protected onControlDeviceChange(deviceId: string): void {
    this.controlForm.patchValue({ deviceId, command: '' });
    this.loadControlComponents(deviceId);
  }

  protected sendQuickCommand(): void {
    if (this.controlForm.invalid) {
      this.controlForm.markAllAsTouched();
      return;
    }

    this.commandFeedback.set(null);
    this.isSendingCommand.set(true);

    this.controlService
      .sendCommand(this.controlForm.getRawValue())
      .pipe(finalize(() => this.isSendingCommand.set(false)))
      .subscribe({
        next: (response) => {
          this.commandFeedback.set(
            `Sent ${response.command} = ${response.action} to ${response.deviceId}`
          );
        },
        error: (error: unknown) => {
          this.commandFeedback.set(extractApiErrorMessage(error, 'Failed to send command.'));
        }
      });
  }

  protected claimDevice(): void {
    if (this.claimForm.invalid) {
      this.claimForm.markAllAsTouched();
      return;
    }

    const deviceId = this.claimForm.controls.deviceId.value.trim();
    if (!deviceId) {
      this.claimForm.controls.deviceId.setValue('');
      this.claimForm.markAllAsTouched();
      return;
    }

    this.claimFeedback.set(null);
    this.isClaimingDevice.set(true);

    this.deviceService
      .claimDevice(deviceId)
      .pipe(finalize(() => this.isClaimingDevice.set(false)))
      .subscribe({
        next: (device) => {
          this.claimFeedback.set(`Claimed ${device.name} (${device.deviceId}).`);
          this.claimForm.reset({ deviceId: '' });
          this.refreshDashboard();
        },
        error: (error: unknown) => {
          this.claimFeedback.set(extractApiErrorMessage(error, 'Unable to claim device.'));
        }
      });
  }

  protected snapshotTimestamp(telemetry: LatestTelemetry | null): string | null {
    if (!telemetry) {
      return null;
    }

    const timestamps = Object.values(telemetry)
      .map((item) => item?.createdAt)
      .filter((value): value is string => Boolean(value))
      .map((value) => new Date(value).getTime());

    if (!timestamps.length) {
      return null;
    }

    return new Date(Math.max(...timestamps)).toISOString();
  }

  private loadControlComponents(deviceId: string): void {
    if (!deviceId) {
      this.controlComponents.set([]);
      this.controlForm.patchValue({ command: '' });
      return;
    }

    this.isLoadingComponents.set(true);

    this.deviceService
      .getComponentsByDeviceId(deviceId)
      .pipe(finalize(() => this.isLoadingComponents.set(false)))
      .subscribe({
        next: (components) => {
          this.controlComponents.set(components);

          const currentCommand = this.controlForm.controls.command.value;
          const commandStillExists = components.some(
            (component) => component.codeName === currentCommand
          );

          this.controlForm.patchValue({
            command: commandStillExists ? currentCommand : components[0]?.codeName ?? ''
          });
        },
        error: () => {
          this.controlComponents.set([]);
          this.controlForm.patchValue({ command: '' });
        }
      });
  }
}
