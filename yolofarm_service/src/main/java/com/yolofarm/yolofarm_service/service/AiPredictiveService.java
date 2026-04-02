package com.yolofarm.yolofarm_service.service;

import com.yolofarm.yolofarm_service.dto.request.ControlRequest;
import com.yolofarm.yolofarm_service.dto.response.AiPredictionResponse;
import com.yolofarm.yolofarm_service.entity.SensorTelemetry;
import com.yolofarm.yolofarm_service.repository.SensorTelemetryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class AiPredictiveService {

    private final SensorTelemetryRepository telemetryRepository;
    private final DeviceControlService controlService;
    private final RestTemplate restTemplate;

    @Value("${ai.service.url:http://localhost:5000/predict}")
    private String aiServiceUrl;

    public void runAiPrediction(String deviceId) {
        log.info(">>> BẮT ĐẦU CHẠY DỰ ĐOÁN AI CHO THIẾT BỊ: {}", deviceId);

        // 1. Lấy dữ liệu cảm biến trong 24h qua (Bảng dọc)
        LocalDateTime oneDayAgo = LocalDateTime.now().minusDays(1);
        List<SensorTelemetry> history = telemetryRepository
                .findByDevice_DeviceIdAndCreatedAtAfterOrderByCreatedAtAsc(deviceId, oneDayAgo);

        if (history.isEmpty()) {
            log.warn(">>> Không có dữ liệu cảm biến trong 24h qua để dự đoán.");
            return;
        }

        // 2. Chuẩn bị Payload gửi sang Python
        // Vì là bảng dọc, mình sẽ gom nhóm lại thành một Map cho AI dễ đọc
        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("deviceId", deviceId);
        requestBody.put("data", history.stream().map(t -> Map.of(
                "type", t.getSensorType(),
                "value", t.getValue(),
                "time", t.getCreatedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
        )).toList());

        // Giả lập thêm dữ liệu thời tiết bên thứ 3
        requestBody.put("externalWeather", Map.of("forecastTemp", 38, "rainProbability", 10));

        try {
            // 3. Gọi con AI Python
            AiPredictionResponse aiResponse = restTemplate.postForObject(aiServiceUrl, requestBody, AiPredictionResponse.class);

            if (aiResponse != null && aiResponse.isShouldWater()) {
                log.info(">>> AI KHUYÊN TƯỚI: {} phút. Lý do: {}", aiResponse.getDuration(), aiResponse.getReason());

                // 4. Thực thi lệnh điều khiển máy bơm (PUMP1) thông qua Service có sẵn
                ControlRequest controlRequest = new ControlRequest();
                controlRequest.setDeviceId(deviceId);
                controlRequest.setCommand("PUMP1");
                controlRequest.setAction("ON");

                controlService.sendControlCommand(controlRequest);

                // Bác có thể dùng thêm @Scheduled để sau X phút thì tự động gửi lệnh "OFF"
            } else {
                log.info(">>> AI DỰ ĐOÁN: Chưa cần tưới nước vào lúc này.");
            }
        } catch (Exception e) {
            log.error(">>> LỖI KHI GỌI MICROSERVICE AI: {}", e.getMessage());
        }
    }
}