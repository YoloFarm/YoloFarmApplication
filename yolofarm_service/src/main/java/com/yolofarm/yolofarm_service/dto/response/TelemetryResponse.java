package com.yolofarm.yolofarm_service.dto.response;

import lombok.AccessLevel;
import lombok.Builder;
import lombok.Data;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

@Data
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class TelemetryResponse {
    Long id;
    String deviceId;
    String sensorType; // VD: TEMP, HUMIDITY
    Double value;      // VD: 35.5
    LocalDateTime createdAt;
}