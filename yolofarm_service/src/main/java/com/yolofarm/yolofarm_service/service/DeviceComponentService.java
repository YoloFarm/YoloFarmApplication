package com.yolofarm.yolofarm_service.service;

import com.yolofarm.yolofarm_service.dto.request.DeviceComponentRequest;
import com.yolofarm.yolofarm_service.dto.response.DeviceComponentResponse;
import com.yolofarm.yolofarm_service.entity.Device;
import com.yolofarm.yolofarm_service.entity.DeviceComponent;
import com.yolofarm.yolofarm_service.exception.AppException;
import com.yolofarm.yolofarm_service.exception.ErrorCode;
import com.yolofarm.yolofarm_service.mapper.DeviceComponentMapper;
import com.yolofarm.yolofarm_service.repository.DeviceComponentRepository;
import com.yolofarm.yolofarm_service.repository.DeviceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DeviceComponentService {

    private final DeviceComponentRepository componentRepository;
    private final DeviceRepository deviceRepository;
    private final DeviceComponentMapper mapper;

    // CHỈ ADMIN MỚI ĐƯỢC THÊM LINH KIỆN
    @PreAuthorize("hasRole('ADMIN')")
    public DeviceComponentResponse createComponent(String deviceId, DeviceComponentRequest request) {
        Device device = deviceRepository.findByDeviceId(deviceId)
                .orElseThrow(() -> new AppException(ErrorCode.DEVICE_NOT_FOUND));

        if (!device.isActive()) {
            throw new AppException(ErrorCode.DEVICE_NOT_FOUND);
        }

        if (componentRepository.findByDevice_DeviceIdAndCodeNameAndActiveTrue(deviceId, request.getCodeName()).isPresent()) {
            throw new AppException(ErrorCode.CODE_NAME_ALREADY_EXISTS_ON_DEVICE);
        }

        DeviceComponent component = mapper.toDeviceComponent(request, device);
        component = componentRepository.save(component);
        return mapper.toDeviceComponentResponse(component);
    }

    public DeviceComponentResponse getComponentById(Long id) {
        DeviceComponent component = componentRepository.findByIdAndActiveTrue(id)
                .orElseThrow(() -> new AppException(ErrorCode.DEVICE_COMPONENT_NOT_FOUND));
        return mapper.toDeviceComponentResponse(component);
    }

    public List<DeviceComponentResponse> getComponentsByDeviceId(String deviceId) {
        deviceRepository.findByDeviceIdAndActiveTrue(deviceId)
                .orElseThrow(() -> new AppException(ErrorCode.DEVICE_NOT_FOUND));

        return componentRepository.findAllByDevice_DeviceIdAndActiveTrue(deviceId)
                .stream()
                .map(mapper::toDeviceComponentResponse)
                .collect(Collectors.toList());
    }

    // CHỈ ADMIN MỚI ĐƯỢC SỬA THÔNG TIN LINH KIỆN
    @PreAuthorize("hasRole('ADMIN')")
    public DeviceComponentResponse updateComponent(Long id, DeviceComponentRequest request) {
        DeviceComponent component = componentRepository.findByIdAndActiveTrue(id)
                .orElseThrow(() -> new AppException(ErrorCode.DEVICE_COMPONENT_NOT_FOUND));

        if (!component.getCodeName().equals(request.getCodeName()) &&
                componentRepository.findByDevice_DeviceIdAndCodeNameAndActiveTrue(
                        component.getDevice().getDeviceId(), request.getCodeName()).isPresent()) {
            throw new AppException(ErrorCode.CODE_NAME_ALREADY_EXISTS_ON_DEVICE);
        }

        mapper.updateDeviceComponent(request, component);
        component = componentRepository.save(component);

        return mapper.toDeviceComponentResponse(component);
    }

    // CHỈ ADMIN MỚI ĐƯỢC XÓA LINH KIỆN
    @PreAuthorize("hasRole('ADMIN')")
    public void deleteComponent(Long id) {
        DeviceComponent component = componentRepository.findByIdAndActiveTrue(id)
                .orElseThrow(() -> new AppException(ErrorCode.DEVICE_COMPONENT_NOT_FOUND));

        component.setActive(false);
        componentRepository.save(component);
    }
}