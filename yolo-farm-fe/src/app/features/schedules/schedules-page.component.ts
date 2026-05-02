import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';
import { Device, DeviceComponent } from '../../core/models/device.models';
import { ScheduleRequest, ScheduleResponse } from '../../core/models/schedule.models';
import { DeviceService } from '../../core/services/device.service';
import { ScheduleService } from '../../core/services/schedule.service';
import { AuthStore } from '../../core/store/auth.store';
import { extractApiErrorMessage } from '../../core/utils/http-error.util';

type ScheduleMode = 'daily' | 'weekly' | 'monthly' | 'interval-minutes' | 'interval-hours' | 'advanced';
type ActionMode = 'preset' | 'custom';

@Component({
  selector: 'app-schedules-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './schedules-page.component.html',
  styleUrl: './schedules-page.component.scss'
})
export class SchedulesPageComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authStore = inject(AuthStore);
  private readonly deviceService = inject(DeviceService);
  private readonly scheduleService = inject(ScheduleService);

  protected readonly devices = signal<Device[]>([]);
  protected readonly components = signal<DeviceComponent[]>([]);
  protected readonly schedules = signal<ScheduleResponse[]>([]);
  protected readonly selectedDeviceId = signal('');
  protected readonly loading = signal(false);
  protected readonly loadingDetails = signal(false);
  protected readonly saving = signal(false);
  protected readonly deletingId = signal<number | null>(null);
  protected readonly editingId = signal<number | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly infoMessage = signal<string | null>(null);
  protected readonly actionMode = signal<ActionMode>('preset');
  protected readonly scheduleMode = signal<ScheduleMode>('daily');
  protected readonly scheduleTime = signal('06:00');
  protected readonly scheduleWeekday = signal('MON');
  protected readonly scheduleMonthDay = signal(1);
  protected readonly intervalMinutes = signal(30);
  protected readonly intervalHours = signal(1);

  protected readonly actionOptions = ['ON', 'OFF'];
  protected readonly scheduleModeOptions: Array<{ key: ScheduleMode; label: string }> = [
    { key: 'daily', label: 'Every day' },
    { key: 'weekly', label: 'Every week' },
    { key: 'monthly', label: 'Every month' },
    { key: 'interval-minutes', label: 'Every X minutes' },
    { key: 'interval-hours', label: 'Every X hours' },
    { key: 'advanced', label: 'Advanced cron' }
  ];
  protected readonly weekdayOptions = [
    { key: 'MON', label: 'Monday' },
    { key: 'TUE', label: 'Tuesday' },
    { key: 'WED', label: 'Wednesday' },
    { key: 'THU', label: 'Thursday' },
    { key: 'FRI', label: 'Friday' },
    { key: 'SAT', label: 'Saturday' },
    { key: 'SUN', label: 'Sunday' }
  ];

  protected readonly selectedDevice = computed(
    () => this.devices().find((device) => device.deviceId === this.selectedDeviceId()) ?? null
  );

  protected readonly form = this.fb.nonNullable.group({
    deviceId: ['', Validators.required],
    command: ['', Validators.required],
    action: ['ON', Validators.required],
    customAction: [''],
    cronExpression: ['0 0 6 * * *', Validators.required],
    description: ['']
  });

  ngOnInit(): void {
    this.loadDevices();
  }

  protected loadDevices(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    const request$ =
      this.authStore.role() === 'ADMIN'
        ? this.deviceService.getDevices(0, 200)
        : this.deviceService.getMyDevices(0, 200);

    request$.pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (response) => {
        this.devices.set(response.content);

        const currentDeviceId = this.selectedDeviceId();
        const nextDeviceId = response.content.some((device) => device.deviceId === currentDeviceId)
          ? currentDeviceId
          : response.content[0]?.deviceId ?? '';

        this.selectedDeviceId.set(nextDeviceId);
        this.form.patchValue({ deviceId: nextDeviceId });

        if (!nextDeviceId) {
          this.components.set([]);
          this.schedules.set([]);
          return;
        }

        this.loadDeviceDetails(nextDeviceId);
      },
      error: (error: unknown) => {
        this.errorMessage.set(extractApiErrorMessage(error, 'Unable to load devices.'));
      }
    });
  }

  protected onDeviceChange(deviceId: string): void {
    this.selectedDeviceId.set(deviceId);
    this.cancelEdit();
    this.form.patchValue({ deviceId });
    this.loadDeviceDetails(deviceId);
  }

  protected submitForm(): void {
    this.errorMessage.set(null);
    this.infoMessage.set(null);
    this.syncCronFromBuilder();

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage.set(this.buildInvalidFormMessage());
      return;
    }

    const rawValue = this.form.getRawValue();
    const action =
      this.actionMode() === 'custom'
        ? String(rawValue.customAction).trim()
        : String(rawValue.action).trim();

    if (!action) {
      this.form.controls.customAction.markAsTouched();
      this.errorMessage.set('Please enter an action value.');
      return;
    }

    this.saving.set(true);

    const payload: ScheduleRequest = {
      deviceId: rawValue.deviceId,
      command: rawValue.command,
      action,
      cronExpression: rawValue.cronExpression,
      description: rawValue.description.trim() || undefined
    };
    const scheduleId = this.editingId();
    const request$ = scheduleId
      ? this.scheduleService.updateSchedule(scheduleId, payload)
      : this.scheduleService.createSchedule(payload);

    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.infoMessage.set(
          scheduleId ? 'Schedule updated successfully.' : 'Schedule created successfully.'
        );
        this.cancelEdit();
        this.loadDeviceDetails(this.selectedDeviceId());
      },
      error: (error: unknown) => {
        this.errorMessage.set(extractApiErrorMessage(error, 'Unable to save schedule.'));
      }
    });
  }

  protected editSchedule(schedule: ScheduleResponse): void {
    this.editingId.set(schedule.id);
    this.form.setValue({
      deviceId: schedule.deviceId,
      command: schedule.command,
      action: this.isPresetAction(schedule.action) ? schedule.action : 'ON',
      customAction: this.isPresetAction(schedule.action) ? '' : schedule.action,
      cronExpression: schedule.cronExpression,
      description: schedule.description ?? ''
    });
    this.actionMode.set(this.isPresetAction(schedule.action) ? 'preset' : 'custom');
    this.applyBuilderFromCron(schedule.cronExpression);
  }

  protected deleteSchedule(schedule: ScheduleResponse): void {
    const confirmed = window.confirm(`Delete schedule #${schedule.id}?`);
    if (!confirmed) {
      return;
    }

    this.deletingId.set(schedule.id);
    this.errorMessage.set(null);
    this.infoMessage.set(null);

    this.scheduleService
      .deleteSchedule(schedule.id)
      .pipe(finalize(() => this.deletingId.set(null)))
      .subscribe({
        next: () => {
          this.infoMessage.set('Schedule deleted successfully.');
          if (this.editingId() === schedule.id) {
            this.cancelEdit();
          }
          this.loadDeviceDetails(this.selectedDeviceId());
        },
        error: (error: unknown) => {
          this.errorMessage.set(extractApiErrorMessage(error, 'Unable to delete schedule.'));
        }
      });
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
    this.resetFormForSelectedDevice();
  }

  protected onActionModeChange(value: string): void {
    const mode = value as ActionMode;
    this.actionMode.set(mode);
    if (mode === 'preset') {
      this.form.patchValue({ customAction: '' });
    }
  }

  protected onScheduleModeChange(value: string): void {
    this.scheduleMode.set(value as ScheduleMode);
    this.syncCronFromBuilder();
  }

  protected onScheduleTimeChange(value: string): void {
    this.scheduleTime.set(value || '06:00');
    this.syncCronFromBuilder();
  }

  protected onWeekdayChange(value: string): void {
    this.scheduleWeekday.set(value || 'MON');
    this.syncCronFromBuilder();
  }

  protected onMonthDayChange(value: string): void {
    this.scheduleMonthDay.set(this.clampInteger(value, 1, 31, 1));
    this.syncCronFromBuilder();
  }

  protected onIntervalMinutesChange(value: string): void {
    this.intervalMinutes.set(this.clampInteger(value, 1, 59, 30));
    this.syncCronFromBuilder();
  }

  protected onIntervalHoursChange(value: string): void {
    this.intervalHours.set(this.clampInteger(value, 1, 23, 1));
    this.syncCronFromBuilder();
  }

  protected onAdvancedCronChange(value: string): void {
    this.form.patchValue({ cronExpression: value });
  }

  protected schedulePreview(): string {
    return this.describeCron(this.form.controls.cronExpression.value);
  }

  protected describeCron(cronExpression: string): string {
    const parts = cronExpression.trim().split(/\s+/);
    if (parts.length < 6) {
      return cronExpression;
    }

    const [second, minute, hour, dayOfMonth, month, dayOfWeek] = parts;
    if (second !== '0' || month !== '*') {
      return cronExpression;
    }

    if (minute.startsWith('*/') && hour === '*' && dayOfMonth === '*' && dayOfWeek === '*') {
      return `Every ${minute.replace('*/', '')} minutes`;
    }

    if (minute === '0' && hour.startsWith('*/') && dayOfMonth === '*' && dayOfWeek === '*') {
      return `Every ${hour.replace('*/', '')} hours`;
    }

    if (dayOfMonth === '*' && dayOfWeek === '*') {
      return `Daily at ${this.toClock(hour, minute)}`;
    }

    if (dayOfMonth === '?' && dayOfWeek !== '*') {
      return `Weekly on ${this.weekdayLabel(dayOfWeek)} at ${this.toClock(hour, minute)}`;
    }

    if (dayOfWeek === '?' && dayOfMonth !== '*') {
      return `Monthly on day ${dayOfMonth} at ${this.toClock(hour, minute)}`;
    }

    return cronExpression;
  }

  private loadDeviceDetails(deviceId: string): void {
    if (!deviceId) {
      this.components.set([]);
      this.schedules.set([]);
      return;
    }

    this.loadingDetails.set(true);
    this.errorMessage.set(null);

    forkJoin({
      components: this.deviceService.getComponentsByDeviceId(deviceId),
      schedules: this.scheduleService.getSchedulesByDevice(deviceId)
    })
      .pipe(finalize(() => this.loadingDetails.set(false)))
      .subscribe({
        next: ({ components, schedules }) => {
          this.components.set(components);
          this.schedules.set(schedules);
          this.resetCommandIfNeeded();
        },
        error: (error: unknown) => {
          this.components.set([]);
          this.schedules.set([]);
          this.errorMessage.set(extractApiErrorMessage(error, 'Unable to load schedules.'));
        }
      });
  }

  private resetFormForSelectedDevice(): void {
    this.form.reset({
      deviceId: this.selectedDeviceId(),
      command: this.components()[0]?.codeName ?? '',
      action: 'ON',
      customAction: '',
      cronExpression: '0 0 6 * * *',
      description: ''
    });
    this.actionMode.set('preset');
    this.applyBuilderFromCron('0 0 6 * * *');
  }

  private resetCommandIfNeeded(): void {
    const currentCommand = this.form.controls.command.value;
    const hasCommand = this.components().some((component) => component.codeName === currentCommand);
    if (!hasCommand) {
      this.form.patchValue({ command: this.components()[0]?.codeName ?? '' });
    }
  }

  private toClock(hour: string, minute: string): string {
    const parsedHour = Number.parseInt(hour, 10);
    const parsedMinute = Number.parseInt(minute, 10);
    if (Number.isNaN(parsedHour) || Number.isNaN(parsedMinute)) {
      return `${hour}:${minute}`;
    }

    return `${String(parsedHour).padStart(2, '0')}:${String(parsedMinute).padStart(2, '0')}`;
  }

  private isPresetAction(action: string): boolean {
    return this.actionOptions.includes(action.toUpperCase());
  }

  private buildInvalidFormMessage(): string {
    const invalidFields: string[] = [];

    if (this.form.controls.deviceId.invalid) {
      invalidFields.push('device');
    }

    if (this.form.controls.command.invalid) {
      invalidFields.push('component');
    }

    if (this.form.controls.action.invalid) {
      invalidFields.push('action');
    }

    if (this.form.controls.cronExpression.invalid) {
      invalidFields.push('schedule time');
    }

    if (!invalidFields.length) {
      return 'Please check the schedule form.';
    }

    return `Please fill: ${invalidFields.join(', ')}.`;
  }

  private syncCronFromBuilder(): void {
    if (this.scheduleMode() === 'advanced') {
      return;
    }

    const { hour, minute } = this.parseTime(this.scheduleTime());
    const cronExpression = this.buildCronExpression(hour, minute);
    this.form.patchValue({ cronExpression });
  }

  private buildCronExpression(hour: number, minute: number): string {
    switch (this.scheduleMode()) {
      case 'daily':
        return `0 ${minute} ${hour} * * *`;
      case 'weekly':
        return `0 ${minute} ${hour} ? * ${this.scheduleWeekday()}`;
      case 'monthly':
        return `0 ${minute} ${hour} ${this.scheduleMonthDay()} * ?`;
      case 'interval-minutes':
        return `0 */${this.intervalMinutes()} * * * *`;
      case 'interval-hours':
        return `0 0 */${this.intervalHours()} * * *`;
      case 'advanced':
        return this.form.controls.cronExpression.value;
    }
  }

  private applyBuilderFromCron(cronExpression: string): void {
    const parts = cronExpression.trim().split(/\s+/);
    if (parts.length < 6) {
      this.scheduleMode.set('advanced');
      return;
    }

    const [second, minute, hour, dayOfMonth, month, dayOfWeek] = parts;
    if (second !== '0' || month !== '*') {
      this.scheduleMode.set('advanced');
      return;
    }

    if (minute.startsWith('*/') && hour === '*' && dayOfMonth === '*' && dayOfWeek === '*') {
      this.scheduleMode.set('interval-minutes');
      this.intervalMinutes.set(this.clampInteger(minute.replace('*/', ''), 1, 59, 30));
      return;
    }

    if (minute === '0' && hour.startsWith('*/') && dayOfMonth === '*' && dayOfWeek === '*') {
      this.scheduleMode.set('interval-hours');
      this.intervalHours.set(this.clampInteger(hour.replace('*/', ''), 1, 23, 1));
      return;
    }

    if (dayOfMonth === '*' && dayOfWeek === '*') {
      this.scheduleMode.set('daily');
      this.scheduleTime.set(this.toInputTime(hour, minute));
      return;
    }

    if (dayOfMonth === '?' && dayOfWeek !== '*') {
      this.scheduleMode.set('weekly');
      this.scheduleWeekday.set(dayOfWeek.toUpperCase());
      this.scheduleTime.set(this.toInputTime(hour, minute));
      return;
    }

    if (dayOfWeek === '?' && dayOfMonth !== '*') {
      this.scheduleMode.set('monthly');
      this.scheduleMonthDay.set(this.clampInteger(dayOfMonth, 1, 31, 1));
      this.scheduleTime.set(this.toInputTime(hour, minute));
      return;
    }

    this.scheduleMode.set('advanced');
  }

  private parseTime(value: string): { hour: number; minute: number } {
    const [hour = '6', minute = '0'] = value.split(':');
    return {
      hour: this.clampInteger(hour, 0, 23, 6),
      minute: this.clampInteger(minute, 0, 59, 0)
    };
  }

  private toInputTime(hour: string, minute: string): string {
    const parsedHour = this.clampInteger(hour, 0, 23, 6);
    const parsedMinute = this.clampInteger(minute, 0, 59, 0);
    return `${String(parsedHour).padStart(2, '0')}:${String(parsedMinute).padStart(2, '0')}`;
  }

  private clampInteger(value: string, min: number, max: number, fallback: number): number {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) {
      return fallback;
    }

    return Math.min(max, Math.max(min, parsed));
  }

  private weekdayLabel(value: string): string {
    const labels: Record<string, string> = {
      MON: 'Monday',
      TUE: 'Tuesday',
      WED: 'Wednesday',
      THU: 'Thursday',
      FRI: 'Friday',
      SAT: 'Saturday',
      SUN: 'Sunday'
    };

    return labels[value.toUpperCase()] ?? value;
  }
}
