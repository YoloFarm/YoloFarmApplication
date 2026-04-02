package com.yolofarm.yolofarm_service.controller;

import com.yolofarm.yolofarm_service.dto.response.ApiResponse;
import com.yolofarm.yolofarm_service.service.AiPredictiveService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiPredictiveController {
    private final AiPredictiveService aiPredictiveService;

    @PostMapping
    public ApiResponse<String> triggerAiPrediction(String deviceId) {
        aiPredictiveService.runAiPrediction(deviceId);
        return ApiResponse.<String>builder()
                .result("Đã kích hoạt dự đoán AI cho thiết bị: " + deviceId)
                .build();
    }
}
