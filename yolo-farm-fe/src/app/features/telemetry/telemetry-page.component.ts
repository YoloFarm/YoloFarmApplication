import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ChartConfiguration, ChartData, ChartDataset } from 'chart.js';
import { catchError, firstValueFrom, of } from 'rxjs';
import { Device } from '../../core/models/device.models';
import {
  TelemetryData,
  TelemetryMetric,
  TelemetryRangePreset
} from '../../core/models/telemetry.models';
import { DeviceService } from '../../core/services/device.service';
import { TelemetryService } from '../../core/services/telemetry.service';
import { extractApiErrorMessage } from '../../core/utils/http-error.util';
import { ChartsModule } from '../../shared/charts/charts.module';

type TelemetryChartType = 'line' | 'bar' | 'radar';

@Component({
  selector: 'app-telemetry-page',
  standalone: true,
  imports: [CommonModule, ChartsModule],
  templateUrl: './telemetry-page.component.html',
  styleUrl: './telemetry-page.component.scss'
})
export class TelemetryPageComponent implements OnInit, OnDestroy {
  private readonly deviceService = inject(DeviceService);
  private readonly telemetryService = inject(TelemetryService);

  private readonly chartPageSize = 100;
  private readonly chartMaxPages = 8;
  private readonly chartMaxPoints = 220;
  private readonly realtimeIntervalMs = 10_000;
  private realtimeTimer: ReturnType<typeof setInterval> | null = null;

  private readonly radarNormalizationMax: Record<TelemetryMetric, number> = {
    temperature: 50,
    humidity: 100,
    soilMoisture: 100,
    light: 1000
  };

  private readonly metricPalette: Record<
    TelemetryMetric,
    { label: string; color: string; unit: string }
  > = {
    temperature: { label: 'Temperature', color: '#D96C2E', unit: 'C' },
    humidity: { label: 'Humidity', color: '#1E749D', unit: '%' },
    soilMoisture: { label: 'Soil Moisture', color: '#2F7A3D', unit: '%' },
    light: { label: 'Light', color: '#A66B1F', unit: 'lx' }
  };

  private readonly sensorTypeMap: Record<TelemetryMetric, string> = {
    temperature: 'TEMP',
    humidity: 'HUMIDITY',
    soilMoisture: 'SOIL_MOISTURE',
    light: 'LIGHT'
  };

  protected readonly devices = signal<Device[]>([]);
  protected readonly selectedDeviceId = signal<string>('');
  protected readonly selectedMetric = signal<TelemetryMetric>('temperature');
  protected readonly selectedChartType = signal<TelemetryChartType>('line');
  protected readonly selectedRange = signal<TelemetryRangePreset>('24h');
  protected readonly customStart = signal('');
  protected readonly customEnd = signal('');
  protected readonly realtimeEnabled = signal(false);
  protected readonly lastRealtimeSync = signal<string | null>(null);

  protected readonly latestTelemetry = signal<TelemetryData | null>(null);
  protected readonly history = signal<TelemetryData[]>([]);
  protected readonly chartPoints = signal<TelemetryData[]>([]);
  protected readonly chartLoading = signal(false);

  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly page = signal(0);
  protected readonly size = signal(20);
  protected readonly totalPages = signal(0);
  protected readonly totalElements = signal(0);

  protected readonly metricOptions: Array<{ key: TelemetryMetric; label: string }> = [
    { key: 'temperature', label: 'Temperature' },
    { key: 'humidity', label: 'Humidity' },
    { key: 'soilMoisture', label: 'Soil Moisture' },
    { key: 'light', label: 'Light' }
  ];

  protected readonly rangeOptions: Array<{ key: TelemetryRangePreset; label: string }> = [
    { key: '1h', label: 'Last 1h' },
    { key: '6h', label: 'Last 6h' },
    { key: '24h', label: 'Last 24h' },
    { key: 'custom', label: 'Custom range' }
  ];

  protected readonly chartTypeOptions: Array<{ key: TelemetryChartType; label: string }> = [
    { key: 'line', label: 'Line' },
    { key: 'bar', label: 'Bar' },
    { key: 'radar', label: 'Radar' }
  ];

  protected readonly chartData = signal<ChartData<TelemetryChartType>>({
    labels: [],
    datasets: []
  });

  protected readonly cartesianChartOptions: ChartConfiguration<'line' | 'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 300
    },
    interaction: {
      mode: 'index',
      intersect: false
    },
    scales: {
      x: {
        ticks: {
          autoSkip: true,
          maxRotation: 0,
          color: '#5a6a59'
        },
        grid: {
          color: 'rgba(120, 138, 118, 0.2)'
        }
      },
      y: {
        ticks: {
          color: '#5a6a59'
        },
        grid: {
          color: 'rgba(120, 138, 118, 0.2)'
        }
      }
    },
    plugins: {
      legend: {
        display: true,
        position: 'top'
      }
    }
  };

  protected readonly radarChartOptions: ChartConfiguration<'radar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 300
    },
    scales: {
      r: {
        suggestedMin: 0,
        suggestedMax: 100,
        ticks: {
          stepSize: 20,
          color: '#5a6a59'
        },
        angleLines: {
          color: 'rgba(120, 138, 118, 0.25)'
        },
        grid: {
          color: 'rgba(120, 138, 118, 0.2)'
        },
        pointLabels: {
          color: '#5a6a59'
        }
      }
    },
    plugins: {
      legend: {
        display: true,
        position: 'top'
      }
    }
  };

  protected readonly chartOptions = computed<ChartConfiguration<TelemetryChartType>['options']>(() => {
    if (this.selectedChartType() === 'radar') {
      return this.radarChartOptions as ChartConfiguration<TelemetryChartType>['options'];
    }

    return this.cartesianChartOptions as ChartConfiguration<TelemetryChartType>['options'];
  });

  ngOnInit(): void {
    this.applyPresetWindow('24h');
    void this.loadDeviceList();
  }

  ngOnDestroy(): void {
    this.stopRealtimePolling();
  }

  protected async loadDeviceList(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);

    try {
      const response = await firstValueFrom(this.deviceService.getDevices(0, 200));
      this.devices.set(response.content);

      if (!response.content.length) {
        this.stopRealtimePolling();
        this.selectedDeviceId.set('');
        this.latestTelemetry.set(null);
        this.history.set([]);
        this.chartPoints.set([]);
        this.rebuildChart();
        return;
      }

      const existingSelection = this.selectedDeviceId();
      const hasExistingSelection = response.content.some(
        (device) => device.deviceId === existingSelection
      );

      this.selectedDeviceId.set(
        hasExistingSelection ? existingSelection : response.content[0].deviceId
      );
      this.page.set(0);
      await this.loadTelemetry();
    } catch (error: unknown) {
      this.errorMessage.set(extractApiErrorMessage(error, 'Unable to load devices.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected onDeviceChange(deviceId: string): void {
    this.selectedDeviceId.set(deviceId);
    this.page.set(0);
    void this.loadTelemetry();

    if (this.realtimeEnabled()) {
      this.startRealtimePolling();
    }
  }

  protected async loadTelemetry(): Promise<void> {
    const deviceId = this.selectedDeviceId();
    if (!deviceId) {
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    try {
      const sensorType = this.sensorTypeMap[this.selectedMetric()];
      const [latest, historyPage] = await Promise.all([
        firstValueFrom(this.telemetryService.getLatestTelemetry(deviceId, sensorType).pipe(catchError(() => of(null)))),
        firstValueFrom(this.telemetryService.getTelemetryHistory(deviceId, this.page(), this.size(), sensorType))
      ]);

      this.latestTelemetry.set(latest);
      this.history.set(historyPage.content);
      this.totalPages.set(historyPage.totalPages);
      this.totalElements.set(historyPage.totalElements);

      await this.loadChartHistory();
    } catch (error: unknown) {
      this.errorMessage.set(extractApiErrorMessage(error, 'Unable to load telemetry.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected async refreshChart(): Promise<void> {
    await this.loadChartHistory();
  }

  protected onMetricChange(metricKey: string): void {
    this.selectedMetric.set(metricKey as TelemetryMetric);
    this.rebuildChart();
  }

  protected onChartTypeChange(chartType: string): void {
    this.selectedChartType.set(chartType as TelemetryChartType);
    this.rebuildChart();
  }

  protected onRangeChange(rangeKey: string): void {
    const range = rangeKey as TelemetryRangePreset;
    this.selectedRange.set(range);

    if (range !== 'custom') {
      this.applyPresetWindow(range);
    }

    void this.loadChartHistory();
  }

  protected onCustomStartChange(value: string): void {
    this.customStart.set(value);
  }

  protected onCustomEndChange(value: string): void {
    this.customEnd.set(value);
  }

  protected applyCustomRange(): void {
    this.selectedRange.set('custom');
    void this.loadChartHistory();
  }

  protected toggleRealtime(checked: boolean): void {
    this.realtimeEnabled.set(checked);
    if (checked) {
      this.startRealtimePolling();
    } else {
      this.stopRealtimePolling();
    }
  }

  protected nextPage(): void {
    if (this.page() + 1 >= this.totalPages()) {
      return;
    }

    this.page.set(this.page() + 1);
    void this.loadTableHistory();
  }

  protected previousPage(): void {
    if (this.page() === 0) {
      return;
    }

    this.page.set(this.page() - 1);
    void this.loadTableHistory();
  }

  private async loadTableHistory(): Promise<void> {
    const deviceId = this.selectedDeviceId();
    if (!deviceId) {
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    try {
      const sensorType = this.sensorTypeMap[this.selectedMetric()];
      const historyPage = await firstValueFrom(
        this.telemetryService.getTelemetryHistory(deviceId, this.page(), this.size(), sensorType)
      );

      this.history.set(historyPage.content);
      this.totalPages.set(historyPage.totalPages);
      this.totalElements.set(historyPage.totalElements);
    } catch (error: unknown) {
      this.errorMessage.set(extractApiErrorMessage(error, 'Unable to load telemetry history.'));
    } finally {
      this.loading.set(false);
    }
  }

  private async loadChartHistory(): Promise<void> {
    const deviceId = this.selectedDeviceId();
    if (!deviceId) {
      this.chartPoints.set([]);
      this.rebuildChart();
      return;
    }

    this.chartLoading.set(true);
    this.errorMessage.set(null);

    try {
      let chartRecords = await this.fetchHistoryForRange(deviceId);
      this.chartPoints.set(chartRecords);
      this.rebuildChart();
    } catch (error: unknown) {
      this.errorMessage.set(extractApiErrorMessage(error, 'Unable to load chart data.'));
    } finally {
      this.chartLoading.set(false);
    }
  }

  private hasValuedData(records: TelemetryData[]): boolean {
    if (!records.length) {
      return false;
    }

    // Check nếu có ít nhất 1 record với ít nhất 1 metric không null
    return records.some(
      (record) =>
        record.temperature !== null ||
        record.humidity !== null ||
        record.soilMoisture !== null ||
        record.light !== null
    );
  }

  private async fetchHistoryForRange(deviceId: string): Promise<TelemetryData[]> {
    const { start, end } = this.resolveRangeWindow();
    const records: TelemetryData[] = [];

    // Nếu radar chart, lấy tất cả 4 metric cùng lúc (gọi API 4 lần merge)
    // Nếu line/bar, chỉ lấy 1 metric được chọn
    if (this.selectedChartType() === 'radar') {
      const response = await firstValueFrom(this.telemetryService.getTelemetryHistoryMerged(deviceId, 0, this.chartPageSize * 2));
      records.push(...response.content);
    } else {
      const sensorType = this.sensorTypeMap[this.selectedMetric()];
      let currentPage = 0;

      while (currentPage < this.chartMaxPages) {
        const response = await firstValueFrom(
          this.telemetryService.getTelemetryHistory(deviceId, currentPage, this.chartPageSize, sensorType)
        );

        if (!response.content.length) {
          break;
        }

        records.push(...response.content);

        const oldestRecord = response.content[response.content.length - 1];
        const oldestTime = this.toTimestamp(oldestRecord.createdAt);

        currentPage += 1;

        if (response.last || oldestTime < start.getTime()) {
          break;
        }
      }
    }

    const filteredRecords = this.filterByRange(records, start, end);
    return this.downsample(filteredRecords, this.chartMaxPoints);
  }

  private filterByRange(data: TelemetryData[], start: Date, end: Date): TelemetryData[] {
    return data
      .filter((item) => {
        const timestamp = this.toTimestamp(item.createdAt);
        return timestamp >= start.getTime() && timestamp <= end.getTime();
      })
      .sort((a, b) => this.toTimestamp(a.createdAt) - this.toTimestamp(b.createdAt));
  }

  private downsample(data: TelemetryData[], maxPoints: number): TelemetryData[] {
    if (data.length <= maxPoints) {
      return data;
    }

    const step = Math.ceil(data.length / maxPoints);
    return data.filter((_, index) => index % step === 0 || index === data.length - 1);
  }

  private rebuildChart(): void {
    if (this.selectedChartType() === 'radar') {
      this.rebuildRadarChart();
      return;
    }

    const metric = this.selectedMetric();
    const palette = this.metricPalette[metric];

    const labels = this.chartPoints().map((point) => this.toChartLabel(point.createdAt));
    const values = this.chartPoints().map((point) => this.metricValue(point, metric) ?? 0);

    if (this.selectedChartType() === 'bar') {
      const dataset: ChartDataset<'bar', number[]> = {
        label: `${palette.label} (${palette.unit})`,
        data: values,
        borderColor: palette.color,
        borderWidth: 1,
        backgroundColor: this.withAlpha(palette.color, 0.45)
      };

      this.chartData.set({
        labels,
        datasets: [dataset]
      });
      return;
    }

    const dataset: ChartDataset<'line', number[]> = {
      label: `${palette.label} (${palette.unit})`,
      data: values,
      fill: false,
      borderColor: palette.color,
      borderWidth: 2,
      pointRadius: 2,
      pointHoverRadius: 4,
      tension: 0.28
    };

    this.chartData.set({
      labels,
      datasets: [dataset]
    });
  }

  private rebuildRadarChart(): void {
    const labels = this.metricOptions.map((metric) => metric.label);
    const values = this.metricOptions.map((metric) => {
      const average = this.averageMetric(this.chartPoints(), metric.key);
      if (average === null) {
        return 0;
      }

      return this.toRadarPercent(metric.key, average);
    });

    const dataset: ChartDataset<'radar', number[]> = {
      label: 'Average metric level (%)',
      data: values,
      borderColor: '#255f29',
      backgroundColor: 'rgba(46, 125, 50, 0.18)',
      pointBackgroundColor: '#255f29',
      pointBorderColor: '#ffffff',
      pointHoverBackgroundColor: '#ffffff',
      pointHoverBorderColor: '#255f29',
      borderWidth: 2
    };

    this.chartData.set({
      labels,
      datasets: [dataset]
    });
  }

  private averageMetric(points: TelemetryData[], metric: TelemetryMetric): number | null {
    const validValues = points
      .map((point) => this.metricValue(point, metric))
      .filter((value): value is number => value !== null);

    if (!validValues.length) {
      return null;
    }

    const sum = validValues.reduce((accumulator, value) => accumulator + value, 0);
    return sum / validValues.length;
  }

  private toRadarPercent(metric: TelemetryMetric, value: number): number {
    const maxValue = this.radarNormalizationMax[metric];
    const percentage = (value / maxValue) * 100;

    return Math.max(0, Math.min(100, Number(percentage.toFixed(1))));
  }

  private withAlpha(hexColor: string, alpha: number): string {
    const normalized = hexColor.replace('#', '');
    if (normalized.length !== 6) {
      return `rgba(46, 125, 50, ${alpha})`;
    }

    const red = Number.parseInt(normalized.slice(0, 2), 16);
    const green = Number.parseInt(normalized.slice(2, 4), 16);
    const blue = Number.parseInt(normalized.slice(4, 6), 16);

    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  private startRealtimePolling(): void {
    this.stopRealtimePolling();

    this.realtimeTimer = setInterval(() => {
      void this.fetchRealtimeLatest();
    }, this.realtimeIntervalMs);
  }

  private stopRealtimePolling(): void {
    if (!this.realtimeTimer) {
      return;
    }

    clearInterval(this.realtimeTimer);
    this.realtimeTimer = null;
  }

  private async fetchRealtimeLatest(): Promise<void> {
    const deviceId = this.selectedDeviceId();
    if (!deviceId) {
      return;
    }

    try {
      const sensorType = this.sensorTypeMap[this.selectedMetric()];
      const latest = await firstValueFrom(this.telemetryService.getLatestTelemetry(deviceId, sensorType));
      this.latestTelemetry.set(latest);
      this.lastRealtimeSync.set(new Date().toISOString());
      this.mergeRealtimePoint(latest);
    } catch {
      // Keep silent during polling; user still has manual refresh and visible stale data.
    }
  }

  private mergeRealtimePoint(latest: TelemetryData): void {
    const currentPoints = this.chartPoints();
    const alreadyExists = currentPoints.some((item) => item.id === latest.id);
    if (alreadyExists) {
      return;
    }

    const { start, end } = this.resolveRangeWindow();
    const merged = this.downsample(
      this.filterByRange([...currentPoints, latest], start, end),
      this.chartMaxPoints
    );

    this.chartPoints.set(merged);
    this.rebuildChart();

    if (this.page() === 0) {
      const currentHistory = this.history();
      const existsInTable = currentHistory.some((item) => item.id === latest.id);
      if (!existsInTable) {
        this.history.set([latest, ...currentHistory].slice(0, this.size()));
      }
    }
  }

  private metricValue(point: TelemetryData, metric: TelemetryMetric): number | null {
    switch (metric) {
      case 'temperature':
        return point.temperature;
      case 'humidity':
        return point.humidity;
      case 'soilMoisture':
        return point.soilMoisture;
      case 'light':
        return point.light;
    }
  }

  private resolveRangeWindow(): { start: Date; end: Date } {
    const now = new Date();
    const preset = this.selectedRange();

    if (preset === 'custom') {
      const defaultStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const start = this.parseLocalDateTime(this.customStart(), defaultStart);
      const end = this.parseLocalDateTime(this.customEnd(), now);

      if (start.getTime() <= end.getTime()) {
        return { start, end };
      }

      return { start: end, end: start };
    }

    const hours = preset === '1h' ? 1 : preset === '6h' ? 6 : 24;
    return {
      start: new Date(now.getTime() - hours * 60 * 60 * 1000),
      end: now
    };
  }

  private applyPresetWindow(preset: Exclude<TelemetryRangePreset, 'custom'>): void {
    const now = new Date();
    const hours = preset === '1h' ? 1 : preset === '6h' ? 6 : 24;
    const start = new Date(now.getTime() - hours * 60 * 60 * 1000);

    this.customStart.set(this.toLocalInputValue(start));
    this.customEnd.set(this.toLocalInputValue(now));
  }

  private toLocalInputValue(date: Date): string {
    const timezoneOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
  }

  private parseLocalDateTime(value: string, fallback: Date): Date {
    const parsedDate = value ? new Date(value) : fallback;
    if (Number.isNaN(parsedDate.getTime())) {
      return fallback;
    }
    return parsedDate;
  }

  private toTimestamp(value: string): number {
    return new Date(value).getTime();
  }

  private toChartLabel(value: string): string {
    return new Date(value).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
