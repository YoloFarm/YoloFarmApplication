package com.yolofarm.yolofarm_service.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.AccessLevel;
import lombok.Data;
import lombok.experimental.FieldDefaults;

@Data
@FieldDefaults(level = AccessLevel.PRIVATE)
public class DeviceRequest {
    @NotBlank(message = "Mã thiết bị không được để trống")
    String deviceId;

    @NotBlank(message = "Tên thiết bị không được để trống")
    String name;
}
