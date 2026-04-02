export type TelemetryMetric = 'temperature' | 'humidity' | 'soilMoisture' | 'light';

export type TelemetryRangePreset = '1h' | '6h' | '24h' | 'custom';

export interface TelemetryData {
  id: number;
  deviceId: string;
  temperature: number | null;
  humidity: number | null;
  soilMoisture: number | null;
  light: number | null;
  createdAt: string;
}
