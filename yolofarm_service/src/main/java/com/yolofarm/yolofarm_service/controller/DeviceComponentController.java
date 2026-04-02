package com.yolofarm.yolofarm_service.controller;

import com.yolofarm.yolofarm_service.dto.request.DeviceComponentRequest;
import com.yolofarm.yolofarm_service.dto.response.ApiResponse;
import com.yolofarm.yolofarm_service.dto.response.DeviceComponentResponse;
import com.yolofarm.yolofarm_service.service.DeviceComponentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api")
public class DeviceComponentController {

    private final DeviceComponentService service;

    @PostMapping("/devices/{deviceId}/components")
    public ApiResponse<DeviceComponentResponse> createComponent(
            @PathVariable String deviceId,
            @Valid @RequestBody DeviceComponentRequest request) {
        return ApiResponse.<DeviceComponentResponse>builder()
                .result(service.createComponent(deviceId, request))
                .build();
    }

    @GetMapping("/devices/{deviceId}/components")
    public ApiResponse<List<DeviceComponentResponse>> getComponentsByDeviceId(@PathVariable String deviceId) {
        return ApiResponse.<List<DeviceComponentResponse>>builder()
                .result(service.getComponentsByDeviceId(deviceId))
                .build();
    }



    @GetMapping("/components/{id}")
    public ApiResponse<DeviceComponentResponse> getComponentById(@PathVariable Long id) {
        return ApiResponse.<DeviceComponentResponse>builder()
                .result(service.getComponentById(id))
                .build();
    }

    @PutMapping("/components/{id}")
    public ApiResponse<DeviceComponentResponse> updateComponent(
            @PathVariable Long id,
            @Valid @RequestBody DeviceComponentRequest request) {
        return ApiResponse.<DeviceComponentResponse>builder()
                .result(service.updateComponent(id, request))
                .build();
    }

    @DeleteMapping("/components/{id}")
    public ApiResponse<String> deleteComponent(@PathVariable Long id) {
        service.deleteComponent(id);
        return ApiResponse.<String>builder()
                .result("Component with id " + id + " deleted successfully")
                .build();
    }
}