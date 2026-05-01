package com.yolofarm.yolofarm_service.controller;

import com.yolofarm.yolofarm_service.dto.request.DeviceRequest;
import com.yolofarm.yolofarm_service.dto.response.ApiResponse;
import com.yolofarm.yolofarm_service.dto.response.DeviceResponse;
import com.yolofarm.yolofarm_service.service.DeviceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/devices")
public class DeviceController {

    private final DeviceService service;

    // ==========================================
    // QUYỀN ADMIN: QUẢN LÝ KHO THIẾT BỊ
    // ==========================================
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<DeviceResponse> createDevice(@Valid @RequestBody DeviceRequest request) {
        return ApiResponse.<DeviceResponse>builder()
                .result(service.createDevice(request))
                .build();
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Page<DeviceResponse>> getAllDevices(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        return ApiResponse.<Page<DeviceResponse>>builder()
                .result(service.getAllDevices(page, size))
                .build();
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<DeviceResponse> updateDevice(@PathVariable Long id, @Valid @RequestBody DeviceRequest request) {
        return ApiResponse.<DeviceResponse>builder()
                .result(service.updateDevice(id, request))
                .build();
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<String> deleteDevice(@PathVariable Long id) {
        service.deleteDevice(id);
        return ApiResponse.<String>builder()
                .result("Đã xóa thành công thiết bị có id: " + id)
                .build();
    }

    // ==========================================
    // QUYỀN CHUNG (USER & ADMIN): SỬ DỤNG THIẾT BỊ
    // ==========================================

    // API để Frontend gọi xem danh sách thiết bị của tài khoản đang đăng nhập
    @GetMapping("/my")
    @PreAuthorize("hasAnyRole('USER', 'ADMIN')")
    public ApiResponse<Page<DeviceResponse>> getMyDevices(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        return ApiResponse.<Page<DeviceResponse>>builder()
                .result(service.getMyDevices(page, size))
                .build();
    }

    // API nhận thiết bị về tài khoản (Claim)
    @PostMapping("/{deviceId}/claim")
    @PreAuthorize("hasAnyRole('USER', 'ADMIN')")
    public ApiResponse<DeviceResponse> claimDevice(@PathVariable String deviceId) {
        return ApiResponse.<DeviceResponse>builder()
                .result(service.claimDevice(deviceId))
                .build();
    }

    // API xem chi tiết 1 thiết bị theo ID DB
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('USER', 'ADMIN')")
    public ApiResponse<DeviceResponse> getDeviceById(@PathVariable Long id) {
        return ApiResponse.<DeviceResponse>builder()
                .result(service.getDeviceById(id))
                .build();
    }
}