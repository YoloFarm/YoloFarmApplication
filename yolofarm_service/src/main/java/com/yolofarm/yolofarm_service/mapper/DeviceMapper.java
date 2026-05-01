package com.yolofarm.yolofarm_service.mapper;

import com.yolofarm.yolofarm_service.dto.request.DeviceRequest;
import com.yolofarm.yolofarm_service.dto.response.DeviceResponse;
import com.yolofarm.yolofarm_service.entity.Device;
import com.yolofarm.yolofarm_service.enums.DeviceStatus;
import org.springframework.stereotype.Service;

@Service
public class DeviceMapper {
    public Device toDevice(DeviceRequest request){
        return Device.builder()
                .deviceId(request.getDeviceId())
                .name(request.getName())
                .status(DeviceStatus.OFFLINE)
                .active(true)
                .build();

    }

    public DeviceResponse toDeviceResponse(Device device){
        return DeviceResponse.builder()
                .id(device.getId())
                .deviceId(device.getDeviceId())
                .name(device.getName())
                .status(device.getStatus())
                .ownerEmail(device.getOwnerEmail())
                .build();
    }

    public void updateDevice(DeviceRequest request, Device device) {
        if (request.getDeviceId() != null) {
            device.setDeviceId(request.getDeviceId());
        }
        if (request.getName() != null) {
            device.setName(request.getName());
        }
    }
}
