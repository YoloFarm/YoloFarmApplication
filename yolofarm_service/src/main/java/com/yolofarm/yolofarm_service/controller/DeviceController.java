package com.yolofarm.yolofarm_service.controller;

import com.yolofarm.yolofarm_service.dto.request.DeviceRequest;
import com.yolofarm.yolofarm_service.dto.response.ApiResponse;
import com.yolofarm.yolofarm_service.dto.response.DeviceResponse;
import com.yolofarm.yolofarm_service.service.DeviceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/devices")
public class DeviceController {

    private final DeviceService service;

    @PostMapping
    public ApiResponse<DeviceResponse> createDevice(@Valid @RequestBody DeviceRequest request) {
        return ApiResponse.<DeviceResponse>builder()
                .result(service.createDevice(request))
                .build();
    }

    @GetMapping("/{id}")
    public ApiResponse<DeviceResponse> getDeviceById(@PathVariable Long id) {
        return ApiResponse.<DeviceResponse>builder()
                .result(service.getDeviceById(id))
                .build();
    }

    @GetMapping
    public ApiResponse<Page<DeviceResponse>> getAllDevices(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        return ApiResponse.<Page<DeviceResponse>>builder()
                .result(service.getAllDevices(page, size))
                .build();
    }

    @PutMapping("/{id}")
    public ApiResponse<DeviceResponse> updateDevice(@PathVariable Long id, @Valid @RequestBody DeviceRequest request) {
        return ApiResponse.<DeviceResponse>builder()
                .result(service.updateDevice(id, request))
                .build();
    }

    @DeleteMapping("/{id}")
    public ApiResponse<String> deleteDevice(@PathVariable Long id) {
        service.deleteDevice(id);
        return ApiResponse.<String>builder()
                .result("Device with id " + id + " deleted successfully")
                .build();
    }
}
