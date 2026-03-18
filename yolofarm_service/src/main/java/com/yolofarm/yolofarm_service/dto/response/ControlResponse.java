package com.yolofarm.yolofarm_service.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class ControlResponse {
    private String deviceId;
    private String command;
    private String action;
    private LocalDateTime createdAt;
}
