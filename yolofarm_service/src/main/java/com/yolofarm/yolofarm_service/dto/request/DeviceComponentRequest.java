package com.yolofarm.yolofarm_service.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.AccessLevel;
import lombok.Data;
import lombok.experimental.FieldDefaults;

@Data
@FieldDefaults(level = AccessLevel.PRIVATE)
public class DeviceComponentRequest {
    @NotBlank(message = "Tên linh kiện không được để trống")
    String name;

    @NotBlank(message = "Mã linh kiện không được để trống")
    String codeName;
}