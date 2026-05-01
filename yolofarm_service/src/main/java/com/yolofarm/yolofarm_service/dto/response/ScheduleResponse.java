package com.yolofarm.yolofarm_service.dto.response;

import lombok.*;
import java.time.LocalDateTime;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class ScheduleResponse {
    private Long id;
    private String deviceId;
    private String command;
    private String action;
    private String cronExpression;
    private String description;
    private boolean active;
    private LocalDateTime createdAt;
}