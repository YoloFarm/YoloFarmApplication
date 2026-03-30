package com.yolofarm.yolofarm_service.controller;

import com.yolofarm.yolofarm_service.dto.response.TelemetryResponse;
import com.yolofarm.yolofarm_service.dto.response.ApiResponse;
import com.yolofarm.yolofarm_service.service.TelemetryService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/telemetry")
@RequiredArgsConstructor
public class TelemetryController {

    private final TelemetryService telemetryService;


    @GetMapping("/latest/{deviceId}")
    public ApiResponse<TelemetryResponse> getLatestTelemetry(
            @PathVariable String deviceId,
            @RequestParam String sensorType // Bổ sung tham số này
    ) {
        return ApiResponse.<TelemetryResponse>builder()
                .result(telemetryService.getLatestTelemetry(deviceId, sensorType))
                .build();
    }


    @GetMapping("/history/{deviceId}")
    public ApiResponse<Page<TelemetryResponse>> getTelemetryHistory(
            @PathVariable String deviceId,
            @RequestParam String sensorType, // Bổ sung tham số này
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return ApiResponse.<Page<TelemetryResponse>>builder()
                .result(telemetryService.getTelemetryHistory(deviceId, sensorType, page, size))
                .build();
    }
}