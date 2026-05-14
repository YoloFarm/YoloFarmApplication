import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import {
  AlertOperator,
  AlertRuleRequest,
  AlertRuleResponse,
  SensorType
} from '../../core/models/alert-rule.models';
import { Device } from '../../core/models/device.models';
import { AlertRuleService } from '../../core/services/alert-rule.service';
import { DeviceService } from '../../core/services/device.service';
import { AuthStore } from '../../core/store/auth.store';
import { extractApiErrorMessage } from '../../core/utils/http-error.util';

@Component({
  selector: 'app-alert-rules-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './alert-rules-page.component.html',
  styleUrl: './alert-rules-page.component.scss'
})
export class AlertRulesPageComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authStore = inject(AuthStore);
  private readonly deviceService = inject(DeviceService);
  private readonly alertRuleService = inject(AlertRuleService);

  protected readonly devices = signal<Device[]>([]);
  protected readonly rules = signal<AlertRuleResponse[]>([]);
  protected readonly selectedDeviceId = signal('');
  protected readonly loading = signal(false);
  protected readonly loadingRules = signal(false);
  protected readonly saving = signal(false);
  protected readonly deletingId = signal<number | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly infoMessage = signal<string | null>(null);

  protected readonly sensorOptions: Array<{ key: SensorType; label: string; unit: string }> = [
    { key: 'TEMP', label: 'Temperature', unit: 'C' },
    { key: 'HUMIDITY', label: 'Humidity', unit: '%' },
    { key: 'SOIL_MOISTURE', label: 'Soil Moisture', unit: '%' },
    { key: 'LIGHT', label: 'Light', unit: 'lx' }
  ];

  protected readonly operatorOptions: Array<{ key: AlertOperator; label: string; symbol: string }> = [
    { key: 'GREATER_THAN', label: 'Greater Than', symbol: '>' },
    { key: 'LESS_THAN', label: 'Less Than', symbol: '<' },
    { key: 'EQUAL', label: 'Equal', symbol: '=' }
  ];

  protected readonly selectedDevice = computed(
    () => this.devices().find((device) => device.deviceId === this.selectedDeviceId()) ?? null
  );

  protected readonly form = this.fb.nonNullable.group({
    deviceId: ['', Validators.required],
    sensorType: ['TEMP' as SensorType, Validators.required],
    operator: ['GREATER_THAN' as AlertOperator, Validators.required],
    threshold: [40, Validators.required],
    alertMessage: ['']
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
          this.rules.set([]);
          return;
        }

        this.loadRules(nextDeviceId);
      },
      error: (error: unknown) => {
        this.errorMessage.set(extractApiErrorMessage(error, 'Unable to load devices.'));
      }
    });
  }

  protected onDeviceChange(deviceId: string): void {
    this.selectedDeviceId.set(deviceId);
    this.form.patchValue({ deviceId });
    this.loadRules(deviceId);
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
    const payload: AlertRuleRequest = {
      ...rawValue,
      threshold: Number(rawValue.threshold),
      alertMessage: rawValue.alertMessage.trim() || undefined
    };

    this.alertRuleService
      .createRule(payload)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.infoMessage.set('Alert rule created successfully.');
          this.form.reset({
            deviceId: this.selectedDeviceId(),
            sensorType: 'TEMP',
            operator: 'GREATER_THAN',
            threshold: 40,
            alertMessage: ''
          });
          this.loadRules(this.selectedDeviceId());
        },
        error: (error: unknown) => {
          this.errorMessage.set(extractApiErrorMessage(error, 'Unable to create alert rule.'));
        }
      });
  }

  protected deleteRule(rule: AlertRuleResponse): void {
    const confirmed = window.confirm(`Delete alert rule #${rule.id}?`);
    if (!confirmed) {
      return;
    }

    this.deletingId.set(rule.id);
    this.errorMessage.set(null);
    this.infoMessage.set(null);

    this.alertRuleService
      .deleteRule(rule.id)
      .pipe(finalize(() => this.deletingId.set(null)))
      .subscribe({
        next: () => {
          this.rules.update((currentRules) => currentRules.filter((currentRule) => currentRule.id !== rule.id));
          this.infoMessage.set('Alert rule deleted successfully.');
          this.loadRules(this.selectedDeviceId());
        },
        error: (error: unknown) => {
          this.errorMessage.set(extractApiErrorMessage(error, 'Unable to delete alert rule.'));
        }
      });
  }

  protected sensorLabel(sensorType: string): string {
    return this.sensorOptions.find((option) => option.key === sensorType)?.label ?? sensorType;
  }

  protected sensorUnit(sensorType: string): string {
    return this.sensorOptions.find((option) => option.key === sensorType)?.unit ?? '';
  }

  protected operatorSymbol(operator: string): string {
    return this.operatorOptions.find((option) => option.key === operator)?.symbol ?? operator;
  }

  private loadRules(deviceId: string): void {
    if (!deviceId) {
      this.rules.set([]);
      return;
    }

    this.loadingRules.set(true);
    this.errorMessage.set(null);

    this.alertRuleService
      .getRulesByDevice(deviceId)
      .pipe(finalize(() => this.loadingRules.set(false)))
      .subscribe({
        next: (rules) => {
          this.rules.set(rules);
        },
        error: (error: unknown) => {
          this.rules.set([]);
          this.errorMessage.set(extractApiErrorMessage(error, 'Unable to load alert rules.'));
        }
      });
  }
}
