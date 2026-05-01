package com.yolofarm.yolofarm_service.dto.request;

import lombok.Data;

@Data
public class ScheduleRequest {
    private String deviceId;
    private String command;
    private String action;
    private String cronExpression;
    private String description;
}