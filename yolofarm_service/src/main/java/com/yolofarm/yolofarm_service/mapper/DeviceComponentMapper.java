package com.yolofarm.yolofarm_service.mapper;

import com.yolofarm.yolofarm_service.dto.request.DeviceComponentRequest;
import com.yolofarm.yolofarm_service.dto.response.DeviceComponentResponse;
import com.yolofarm.yolofarm_service.entity.Device;
import com.yolofarm.yolofarm_service.entity.DeviceComponent;
import org.springframework.stereotype.Service;

@Service
public class DeviceComponentMapper {

    public DeviceComponent toDeviceComponent(DeviceComponentRequest request, Device device) {
        return DeviceComponent.builder()
                .device(device)
                .name(request.getName())
                .codeName(request.getCodeName())
                .status("OFF")
                .active(true)
                .build();
    }

    public DeviceComponentResponse toDeviceComponentResponse(DeviceComponent component) {
        return DeviceComponentResponse.builder()
                .id(component.getId())
                .deviceId(component.getDevice().getDeviceId())
                .name(component.getName())
                .codeName(component.getCodeName())
                .status(component.getStatus())
                .build();
    }

    public void updateDeviceComponent(DeviceComponentRequest request, DeviceComponent component) {
        if (request.getName() != null && !request.getName().isBlank()) {
            component.setName(request.getName());
        }
        if (request.getCodeName() != null && !request.getCodeName().isBlank()) {
            component.setCodeName(request.getCodeName());
        }
    }
}