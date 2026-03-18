package com.yolofarm.yolofarm_service.dto.payload;

import lombok.Data;

@Data
public class TelemetryPayload {
    private String deviceId;
    private Float temperature;
    private Float humidity;
    private Float soilMoisture;
    private Integer light;
}
