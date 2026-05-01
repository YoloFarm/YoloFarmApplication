package com.yolofarm.yolofarm_service.dto.response;

import com.yolofarm.yolofarm_service.enums.DeviceStatus;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Data;
import lombok.experimental.FieldDefaults;

@Data
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class DeviceResponse {
    Long id;
    String deviceId;
    String name;
    DeviceStatus status;
    String ownerEmail;
}