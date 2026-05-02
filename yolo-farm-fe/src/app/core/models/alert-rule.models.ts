export type SensorType = 'TEMP' | 'HUMIDITY' | 'SOIL_MOISTURE' | 'LIGHT';
export type AlertOperator = 'GREATER_THAN' | 'LESS_THAN' | 'EQUAL';

export interface AlertRuleRequest {
  deviceId: string;
  sensorType: SensorType;
  operator: AlertOperator;
  threshold: number;
  alertMessage?: string;
}

export interface AlertRuleResponse {
  id: number;
  deviceId: string;
  sensorType: SensorType | string;
  operator: AlertOperator | string;
  threshold: number;
  alertMessage?: string | null;
  active: boolean;
}
