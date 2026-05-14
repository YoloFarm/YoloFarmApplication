package com.yolofarm.yolofarm_service.controller;


import com.yolofarm.yolofarm_service.dto.request.ControlRequest;
import com.yolofarm.yolofarm_service.dto.response.ApiResponse;
import com.yolofarm.yolofarm_service.dto.response.ControlResponse;
import com.yolofarm.yolofarm_service.dto.response.DeviceActionResponse;
import com.yolofarm.yolofarm_service.service.DeviceControlService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;

@RestController
@RequestMapping("/api/control")
@RequiredArgsConstructor
public class DeviceControlController {
    private final DeviceControlService service;

    @PostMapping
    public ApiResponse<ControlResponse> controlDevice(@Valid @RequestBody ControlRequest request) {
        return ApiResponse.<ControlResponse>builder()
                .result(service.sendControlCommand(request))
                .build();
    }

    @GetMapping("/{deviceId}/actions/logs")
    public ApiResponse<Page<DeviceActionResponse>> getActionLogs(
            @PathVariable String deviceId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        Page<DeviceActionResponse> logs = service.getDeviceActionLogs(deviceId, startDate, endDate, page, size);
        return ApiResponse.<Page<DeviceActionResponse>>builder()
                .result(logs)
                .build();
    }
}
