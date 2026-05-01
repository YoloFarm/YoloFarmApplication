package com.yolofarm.yolofarm_service.dto.response;

import lombok.*;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AlertRuleResponse {
    private Long id;
    private String deviceId;
    private String sensorType;
    private String operator;
    private Double threshold;
    private String alertMessage;
    private boolean active;
}