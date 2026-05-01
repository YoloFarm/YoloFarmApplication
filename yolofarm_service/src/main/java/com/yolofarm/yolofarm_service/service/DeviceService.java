package com.yolofarm.yolofarm_service.service;

import com.yolofarm.yolofarm_service.dto.request.DeviceRequest;
import com.yolofarm.yolofarm_service.dto.response.DeviceResponse;
import com.yolofarm.yolofarm_service.entity.Device;
import com.yolofarm.yolofarm_service.exception.AppException;
import com.yolofarm.yolofarm_service.exception.ErrorCode;
import com.yolofarm.yolofarm_service.mapper.DeviceMapper;
import com.yolofarm.yolofarm_service.repository.DeviceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DeviceService {

    private final DeviceRepository deviceRepository;
    private final DeviceMapper deviceMapper;

    // CHỈ ADMIN MỚI ĐƯỢC NHẬP KHO THIẾT BỊ
    @PreAuthorize("hasRole('ADMIN')")
    public DeviceResponse createDevice(DeviceRequest request) {
        if (deviceRepository.existsByDeviceId(request.getDeviceId())) {
            throw new AppException(ErrorCode.DEVICE_ALREADY_EXISTS);
        }

        Device device = deviceMapper.toDevice(request);
        device = deviceRepository.save(device);
        return deviceMapper.toDeviceResponse(device);
    }

    public DeviceResponse getDeviceById(Long id) {
        Device device = deviceRepository.findByIdAndActiveTrue(id)
                .orElseThrow(() -> new AppException(ErrorCode.DEVICE_NOT_FOUND));

        return deviceMapper.toDeviceResponse(device);
    }

    // CHỈ ADMIN MỚI XEM ĐƯỢC TẤT CẢ THIẾT BỊ TRÊN TOÀN HỆ THỐNG
    @PreAuthorize("hasRole('ADMIN')")
    public Page<DeviceResponse> getAllDevices(int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        return deviceRepository.findAllByActiveTrue(pageable)
                .map(deviceMapper::toDeviceResponse);
    }

    // CHỈ ADMIN MỚI ĐƯỢC SỬA THÔNG TIN PHẦN CỨNG
    @PreAuthorize("hasRole('ADMIN')")
    public DeviceResponse updateDevice(Long id, DeviceRequest request) {
        Device device = deviceRepository.findByIdAndActiveTrue(id)
                .orElseThrow(() -> new AppException(ErrorCode.DEVICE_NOT_FOUND));

        if (!device.getDeviceId().equals(request.getDeviceId()) &&
                deviceRepository.existsByDeviceId(request.getDeviceId())) {
            throw new AppException(ErrorCode.DEVICE_ALREADY_EXISTS);
        }

        deviceMapper.updateDevice(request, device);
        device = deviceRepository.save(device);

        return deviceMapper.toDeviceResponse(device);
    }

    // CHỈ ADMIN MỚI ĐƯỢC XÓA THIẾT BỊ
    @PreAuthorize("hasRole('ADMIN')")
    public void deleteDevice(Long id) {
        Device device = deviceRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.DEVICE_NOT_FOUND));

        device.setActive(false); // Cắm cờ xóa mềm
        deviceRepository.save(device);
    }

    // ==========================================
    // TÍNH NĂNG MỚI: NHẬN THIẾT BỊ (CLAIM)
    // ==========================================
    @Transactional
    public DeviceResponse claimDevice(String deviceId) {
        Device device = deviceRepository.findByDeviceIdAndActiveTrue(deviceId)
                .orElseThrow(() -> new AppException(ErrorCode.DEVICE_NOT_FOUND));

        String currentEmail = SecurityContextHolder.getContext().getAuthentication().getName();

        // Kiểm tra xem thiết bị đã có chủ chưa
        if (device.getOwnerEmail() != null) {
            if (device.getOwnerEmail().equals(currentEmail)) {
                return deviceMapper.toDeviceResponse(device); // Đã nhận rồi thì trả về luôn
            }
            throw new AppException(ErrorCode.DEVICE_ALREADY_CLAIMED);
        }

        device.setOwnerEmail(currentEmail);
        device = deviceRepository.save(device);

        return deviceMapper.toDeviceResponse(device);
    }

    // ==========================================
    // TÍNH NĂNG MỚI: XEM THIẾT BỊ CỦA TÔI
    // ==========================================
    public Page<DeviceResponse> getMyDevices(int page, int size) {
        String currentEmail = SecurityContextHolder.getContext().getAuthentication().getName();
        Pageable pageable = PageRequest.of(page, size);

        return deviceRepository.findAllByOwnerEmailAndActiveTrue(currentEmail, pageable)
                .map(deviceMapper::toDeviceResponse);
    }
}