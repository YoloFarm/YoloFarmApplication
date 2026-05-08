export type TelemetrySensorType = 'TEMP' | 'HUMIDITY' | 'SOIL_MOISTURE' | 'LIGHT';

export interface TelemetryData {
  id: number;
  deviceId: string;
  sensorType: TelemetrySensorType;
  value: number | null;
  createdAt: string;
}

export type LatestTelemetry = Partial<Record<TelemetrySensorType, TelemetryData>>;

export type TelemetryMetric = 'temperature' | 'humidity' | 'soilMoisture' | 'light';

export type TelemetryRangePreset = '1m' | '1h' | '6h' | '24h' | 'custom';
