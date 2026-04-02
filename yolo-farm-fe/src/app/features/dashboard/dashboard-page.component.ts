import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, finalize, forkJoin, map, of, switchMap } from 'rxjs';
import { ControlService } from '../../core/services/control.service';
import { DeviceService } from '../../core/services/device.service';
import { TelemetryService } from '../../core/services/telemetry.service';
import { Device } from '../../core/models/device.models';
import { TelemetryData } from '../../core/models/telemetry.models';
import { extractApiErrorMessage } from '../../core/utils/http-error.util';

interface DeviceSnapshot {
  device: Device;
  telemetry: TelemetryData | null;
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
  private readonly deviceService = inject(DeviceService);
  private readonly telemetryService = inject(TelemetryService);
  private readonly controlService = inject(ControlService);

  protected readonly devices = signal<Device[]>([]);
  protected readonly snapshots = signal<DeviceSnapshot[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly isSendingCommand = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly commandFeedback = signal<string | null>(null);

  protected readonly commandOptions = ['PUMP', 'FAN', 'LED'];
  protected readonly actionOptions = ['ON', 'OFF'];

  protected readonly controlForm = this.fb.nonNullable.group({
    deviceId: ['', Validators.required],
    command: ['PUMP', Validators.required],
    action: ['ON', Validators.required]
  });

  protected readonly onlineCount = computed(
    () => this.devices().filter((device) => device.status === 'ONLINE').length
  );

  protected readonly offlineCount = computed(
    () => this.devices().filter((device) => device.status !== 'ONLINE').length
  );

  protected readonly hasDevices = computed(() => this.devices().length > 0);

  ngOnInit(): void {
    this.refreshDashboard();
  }

  protected refreshDashboard(): void {
    this.errorMessage.set(null);
    this.isLoading.set(true);

    this.deviceService
      .getDevices(0, 50)
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
}
