import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ChartConfiguration, ChartData, ChartDataset, TooltipItem } from 'chart.js';
import { catchError, firstValueFrom, of } from 'rxjs';
import { Device } from '../../core/models/device.models';
import {
  LatestTelemetry,
  TelemetryData,
  TelemetryMetric,
  TelemetryRangePreset,
  TelemetrySensorType
} from '../../core/models/telemetry.models';
import { DeviceService } from '../../core/services/device.service';
import { TelemetryService } from '../../core/services/telemetry.service';
import { AuthStore } from '../../core/store/auth.store';
import { extractApiErrorMessage } from '../../core/utils/http-error.util';
import { ChartsModule } from '../../shared/charts/charts.module';

@Component({
  selector: 'app-telemetry-page',
  standalone: true,
  imports: [CommonModule, ChartsModule],
  templateUrl: './telemetry-page.component.html',
  styleUrl: './telemetry-page.component.scss'
})
export class TelemetryPageComponent implements OnInit, OnDestroy {
  private readonly authStore = inject(AuthStore);
  private readonly deviceService = inject(DeviceService);
  private readonly telemetryService = inject(TelemetryService);

  private readonly chartPageSize = 100;
  private readonly chartMaxPages = 8;
  private readonly chartMaxPoints = 220;
  private readonly realtimeIntervalMs = 10_000;
  private realtimeTimer: ReturnType<typeof setInterval> | null = null;

  private readonly metricPalette: Record<
    TelemetryMetric,
    { label: string; color: string; unit: string; icon: string }
  > = {
    temperature: { label: 'Temperature', color: '#D96C2E', unit: 'C', icon: 'TEMP' },
    humidity: { label: 'Humidity', color: '#1E749D', unit: '%', icon: 'HUM' },
    soilMoisture: { label: 'Soil Moisture', color: '#2F7A3D', unit: '%', icon: 'SOIL' },
    light: { label: 'Light', color: '#A66B1F', unit: 'lx', icon: 'LUX' }
  };

  private readonly sensorTypeMap: Record<TelemetryMetric, TelemetrySensorType> = {
    temperature: 'TEMP',
    humidity: 'HUMIDITY',
    soilMoisture: 'SOIL_MOISTURE',
    light: 'LIGHT'
  };

  protected readonly devices = signal<Device[]>([]);
  protected readonly selectedDeviceId = signal<string>('');
  protected readonly selectedRange = signal<TelemetryRangePreset>('1h');
  protected readonly customStart = signal('');
  protected readonly customEnd = signal('');
  protected readonly realtimeEnabled = signal(false);
  protected readonly lastRealtimeSync = signal<string | null>(null);

  protected readonly latestTelemetry = signal<LatestTelemetry | null>(null);
  protected readonly chartPoints = signal<Record<TelemetryMetric, TelemetryData[]>>({
    temperature: [],
    humidity: [],
    soilMoisture: [],
    light: []
  });
  protected readonly chartLoading = signal(false);

  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly metrics: TelemetryMetric[] = ['temperature', 'humidity', 'soilMoisture', 'light'];

  protected readonly rangeOptions: Array<{ key: TelemetryRangePreset; label: string }> = [
    { key: '1h', label: 'Last 1h' },
    { key: '6h', label: 'Last 6h' },
    { key: '24h', label: 'Last 24h' },
    { key: 'custom', label: 'Custom range' }
  ];

  protected readonly chartData = signal<Record<TelemetryMetric, ChartData<'line'>>>({
    temperature: { labels: [], datasets: [] },
    humidity: { labels: [], datasets: [] },
    soilMoisture: { labels: [], datasets: [] },
    light: { labels: [], datasets: [] }
  });

  protected readonly cartesianChartOptions: ChartConfiguration<'line'>['options'] = {
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

  protected getChartOptions(metric: TelemetryMetric): ChartConfiguration<'line'>['options'] {
    return {
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
        },
        tooltip: {
          callbacks: {
            title: (items: TooltipItem<'line'>[]) => {
              const dataIndex = items[0]?.dataIndex ?? 0;
              const point = this.chartPoints()[metric]?.[dataIndex];
              return point ? this.toTooltipDateTime(point.createdAt) : '';
            },
            label: (item: TooltipItem<'line'>) => {
              const palette = this.metricPalette[metric];
              return `${palette.label}: ${item.parsed.y} ${palette.unit}`;
            }
          }
        }
      }
    };
  }

  ngOnInit(): void {
    this.applyPresetWindow('24h');
    void this.loadDeviceList();
  }

  ngOnDestroy(): void {
    this.stopRealtimePolling();
  }

  protected getMetricConfig(metric: TelemetryMetric) {
    return this.metricPalette[metric];
  }

  protected getLatestMetric(metric: TelemetryMetric): TelemetryData | null {
    const latest = this.latestTelemetry();
    if (!latest) {
      return null;
    }

    return latest[this.sensorTypeMap[metric]] ?? null;
  }

  protected async loadDeviceList(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);

    try {
      const response = await firstValueFrom(
        this.authStore.role() === 'ADMIN'
          ? this.deviceService.getDevices(0, 200)
          : this.deviceService.getMyDevices(0, 200)
      );
      this.devices.set(response.content);

      if (!response.content.length) {
        this.stopRealtimePolling();
        this.selectedDeviceId.set('');
        this.latestTelemetry.set(null);
        this.chartPoints.set({
          temperature: [],
          humidity: [],
          soilMoisture: [],
          light: []
        });
        this.rebuildCharts();
        return;
      }

      const existingSelection = this.selectedDeviceId();
      const hasExistingSelection = response.content.some(
        (device) => device.deviceId === existingSelection
      );

      this.selectedDeviceId.set(
        hasExistingSelection ? existingSelection : response.content[0].deviceId
      );
      await this.loadTelemetry();
    } catch (error: unknown) {
      this.errorMessage.set(extractApiErrorMessage(error, 'Unable to load devices.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected onDeviceChange(deviceId: string): void {
    this.selectedDeviceId.set(deviceId);
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
      const [latest] = await Promise.all([
        firstValueFrom(this.telemetryService.getLatestTelemetry(deviceId).pipe(catchError(() => of(null)))),
        this.loadChartHistory()
      ]);

      this.latestTelemetry.set(latest);
    } catch (error: unknown) {
      this.errorMessage.set(extractApiErrorMessage(error, 'Unable to load telemetry.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected async refreshChart(): Promise<void> {
    await this.loadChartHistory();
  }

  protected onRangeChange(rangeKey: string): void {
    const range = rangeKey as TelemetryRangePreset;
    this.selectedRange.set(range);

    if (range !== 'custom') {
      this.applyPresetWindow(range);
    }

    this.clearChartData();
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

  private async loadChartHistory(): Promise<void> {
    const deviceId = this.selectedDeviceId();
    if (!deviceId) {
      this.chartPoints.set({
        temperature: [],
        humidity: [],
        soilMoisture: [],
        light: []
      });
      this.rebuildCharts();
      return;
    }

    this.chartLoading.set(true);
    this.errorMessage.set(null);

    try {
      const rangeWindow = this.resolveRangeWindow();
      const results = await Promise.all(
        this.metrics.map((metric) =>
          this.fetchHistoryForMetric(deviceId, metric, rangeWindow.start, rangeWindow.end)
        )
      );

      const nextPoints = this.metrics.reduce(
        (acc, metric, index) => {
          acc[metric] = this.filterByRange(results[index], rangeWindow.start, rangeWindow.end);
          return acc;
        },
        {} as Record<TelemetryMetric, TelemetryData[]>
      );

      this.chartPoints.set(nextPoints);
      this.rebuildCharts();
    } catch (error: unknown) {
      this.errorMessage.set(extractApiErrorMessage(error, 'Unable to load chart data.'));
    } finally {
      this.chartLoading.set(false);
    }
  }

  private async fetchHistoryForMetric(
    deviceId: string,
    metric: TelemetryMetric,
    start: Date,
    end: Date
  ): Promise<TelemetryData[]> {
    const records: TelemetryData[] = [];
    const sensorType = this.sensorTypeMap[metric];

    let currentPage = 0;

    while (currentPage < this.chartMaxPages) {
      const response = await firstValueFrom(
        this.telemetryService.getTelemetryHistory(deviceId, currentPage, this.chartPageSize, sensorType)
      );

      if (!response.content.length) {
        break;
      }

      records.push(...response.content);

      const pageTimestamps = response.content
        .map((record) => this.toTimestamp(record.createdAt))
        .filter((timestamp) => timestamp > 0);
      const oldestTime = pageTimestamps.length ? Math.min(...pageTimestamps) : 0;

      currentPage += 1;

      if (response.last || oldestTime < start.getTime()) {
        break;
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

  private rebuildCharts(): void {
    const { start, end } = this.resolveRangeWindow();
    const newChartData: Record<TelemetryMetric, ChartData<'line'>> = {
      temperature: { labels: [], datasets: [] },
      humidity: { labels: [], datasets: [] },
      soilMoisture: { labels: [], datasets: [] },
      light: { labels: [], datasets: [] }
    };

    for (const metric of this.metrics) {
      const palette = this.metricPalette[metric];
      const points = this.filterByRange(this.chartPoints()[metric] ?? [], start, end);
      const labels = points.map((point) => this.toChartLabel(point.createdAt));
      const values = points.map((point) => point.value ?? 0);

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

      newChartData[metric] = {
        labels,
        datasets: [dataset]
      };
    }

    this.chartData.set(newChartData);
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
      const latest = await firstValueFrom(this.telemetryService.getLatestTelemetry(deviceId));
      this.latestTelemetry.set(latest);
      this.lastRealtimeSync.set(new Date().toISOString());
      this.mergeRealtimePoints(latest);
    } catch {
      // Keep silent during polling; user still has manual refresh and visible stale data.
    }
  }

  private mergeRealtimePoints(latest: LatestTelemetry | null): void {
    if (!latest) {
      return;
    }

    const { start, end } = this.resolveRangeWindow();
    const currentPoints = this.chartPoints();
    const nextPoints: Record<TelemetryMetric, TelemetryData[]> = {
      temperature: currentPoints.temperature ?? [],
      humidity: currentPoints.humidity ?? [],
      soilMoisture: currentPoints.soilMoisture ?? [],
      light: currentPoints.light ?? []
    };

    for (const metric of this.metrics) {
      const sensorType = this.sensorTypeMap[metric];
      const latestRecord = latest[sensorType];
      const metricPoints = nextPoints[metric] ?? [];

      if (!latestRecord) {
        continue;
      }

      if (metricPoints.some((item) => item.id === latestRecord.id)) {
        continue;
      }

      nextPoints[metric] = this.downsample(
        this.filterByRange([...metricPoints, latestRecord], start, end),
        this.chartMaxPoints
      );
    }

    this.chartPoints.set(nextPoints);
    this.rebuildCharts();
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
    const timestamp = new Date(value).getTime();
    return Number.isNaN(timestamp) ? 0 : timestamp;
  }

  private clearChartData(): void {
    this.chartPoints.set({
      temperature: [],
      humidity: [],
      soilMoisture: [],
      light: []
    });
    this.rebuildCharts();
  }

  private toChartLabel(value: string): string {
    const date = new Date(value);
    const { start, end } = this.resolveRangeWindow();
    const spanHours = (end.getTime() - start.getTime()) / (60 * 60 * 1000);

    if (spanHours >= 12) {
      return date.toLocaleString([], {
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    }

    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  private toTooltipTime(value: string): string {
    return new Date(value).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  private toTooltipDateTime(value: string): string {
    return new Date(value).toLocaleString([], {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  }
}
