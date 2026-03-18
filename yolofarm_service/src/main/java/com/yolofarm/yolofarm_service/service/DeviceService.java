package com.yolofarm.yolofarm_service.service;

import com.yolofarm.yolofarm_service.dto.request.DeviceRequest;
import com.yolofarm.yolofarm_service.dto.response.DeviceResponse;
import com.yolofarm.yolofarm_service.entity.Device;
import com.yolofarm.yolofarm_service.enums.DeviceStatus;
import com.yolofarm.yolofarm_service.exception.AppException;
import com.yolofarm.yolofarm_service.exception.ErrorCode;
import com.yolofarm.yolofarm_service.mapper.DeviceMapper;
import com.yolofarm.yolofarm_service.repository.DeviceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DeviceService {

    private final DeviceRepository deviceRepository;
    private final DeviceMapper deviceMapper;

    // 1. CREATE DEVICE
    public DeviceResponse createDevice(DeviceRequest request) {
        if (deviceRepository.existsByDeviceId(request.getDeviceId())) {
            throw new AppException(ErrorCode.DEVICE_ALREADY_EXISTS);
        }

        Device device = deviceMapper.toDevice(request);
        device = deviceRepository.save(device);
        return deviceMapper.toDeviceResponse(device);
    }

    public DeviceResponse getDeviceById(Long id) {
        Device device = deviceRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.DEVICE_NOT_FOUND));

        if (!device.isActive()) {
            throw new AppException(ErrorCode.DEVICE_NOT_FOUND); // Đã xóa mềm thì coi như ko thấy
        }

        return deviceMapper.toDeviceResponse(device);
    }

    // 3. GET ALL (PHÂN TRANG + SOFT DELETE)
    public Page<DeviceResponse> getAllDevices(int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        return deviceRepository.findAllByActiveTrue(pageable)
                .map(deviceMapper::toDeviceResponse);
    }

    // 4. UPDATE DEVICE
    public DeviceResponse updateDevice(Long id, DeviceRequest request) {
        Device device = deviceRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.DEVICE_NOT_FOUND));

        if (!device.isActive()) {
            throw new AppException(ErrorCode.DEVICE_NOT_FOUND);
        }

        // Chống lách luật: Nếu đổi sang deviceId khác mà ID đó lại bị thiết bị khác chiếm rồi thì văng lỗi
        if (!device.getDeviceId().equals(request.getDeviceId()) &&
                deviceRepository.existsByDeviceId(request.getDeviceId())) {
            throw new AppException(ErrorCode.DEVICE_ALREADY_EXISTS);
        }

        deviceMapper.updateDevice(request, device);
        device = deviceRepository.save(device);

        return deviceMapper.toDeviceResponse(device);
    }

    // 5. DELETE DEVICE (SOFT DELETE)
    public void deleteDevice(Long id) {
        Device device = deviceRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.DEVICE_NOT_FOUND));

        device.setActive(false); // Cắm cờ xóa mềm
        deviceRepository.save(device);
    }
}