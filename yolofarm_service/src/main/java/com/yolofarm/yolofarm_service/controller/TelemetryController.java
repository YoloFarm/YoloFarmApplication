package com.yolofarm.yolofarm_service.controller;

import com.yolofarm.yolofarm_service.dto.response.TelemetryResponse;
import com.yolofarm.yolofarm_service.dto.response.ApiResponse;
import com.yolofarm.yolofarm_service.service.TelemetryService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/telemetry")
@RequiredArgsConstructor
public class TelemetryController {

    private final TelemetryService telemetryService;


    @GetMapping("/{deviceId}/latest")
    public ApiResponse<Map<String, TelemetryResponse>> getLatestAll(@PathVariable String deviceId) {
        return ApiResponse.<Map<String, TelemetryResponse>>builder()
                .result(telemetryService.getLatestTelemetryAll(deviceId))
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