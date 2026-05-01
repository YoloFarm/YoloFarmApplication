package com.yolofarm.yolofarm_service.dto.request;

import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AlertRuleRequest {
    private String deviceId;
    private String sensorType; // TEMP, HUMIDITY...
    private String operator;   // GREATER_THAN, LESS_THAN
    private Double threshold;
    private String alertMessage;
}