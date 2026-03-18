package com.yolofarm.yolofarm_service.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ControlRequest {
    @NotBlank(message = "Mã thiết bị không được để trống")
    private String deviceId; // Lệnh này gửi cho mạch nào (VD: YOLO-001)

    @NotBlank(message = "Tên lệnh không được để trống")
    private String command;  // Tên linh kiện (VD: PUMP, FAN, LED)

    @NotBlank(message = "Hành động không được để trống")
    private String action;   // Trạng thái (VD: ON, OFF, 50)
}