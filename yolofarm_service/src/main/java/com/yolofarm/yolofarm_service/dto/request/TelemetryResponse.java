package com.yolofarm.yolofarm_service.dto.request;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class TelemetryResponse {
    private Long id;
    private String deviceId;
    private Float temperature;
    private Float humidity;
    private Float soilMoisture;
    private Integer light;
    private LocalDateTime createdAt;
}