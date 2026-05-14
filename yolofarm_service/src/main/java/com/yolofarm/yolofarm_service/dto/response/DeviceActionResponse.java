package com.yolofarm.yolofarm_service.dto.response;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Builder
public class DeviceActionResponse {
    private Long id;
    private String deviceId;
    private String component; // Lấy từ trường command (VD: PUMP1, FAN1)
    private String action;    // Lấy từ trường action (VD: ON, OFF, 50)
    private String executedBy; // Lấy từ trường createdBy của Auditing
    private LocalDateTime executedAt; // Lấy từ trường createdAt của Auditing
}