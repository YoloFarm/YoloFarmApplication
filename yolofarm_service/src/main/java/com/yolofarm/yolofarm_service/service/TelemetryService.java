package com.yolofarm.yolofarm_service.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yolofarm.yolofarm_service.dto.payload.TelemetryPayload;
import com.yolofarm.yolofarm_service.dto.request.TelemetryResponse;
import com.yolofarm.yolofarm_service.entity.Device;
import com.yolofarm.yolofarm_service.entity.SensorTelemetry;
import com.yolofarm.yolofarm_service.exception.AppException;
import com.yolofarm.yolofarm_service.exception.ErrorCode;
import com.yolofarm.yolofarm_service.repository.DeviceRepository;
import com.yolofarm.yolofarm_service.repository.SensorTelemetryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class TelemetryService {

    private final SensorTelemetryRepository repository;
    private final DeviceRepository deviceRepository;
    private final ObjectMapper objectMapper;
    private final RedisService redisService;


    private static final String REDIS_KEY_PREFIX = "telemetry:latest:";

    public void processAndSave(String jsonPayload) {
        try {

            TelemetryPayload data = objectMapper.readValue(jsonPayload, TelemetryPayload.class);

            if (data.getDeviceId() == null || data.getDeviceId().isBlank()) {
                log.warn(">>> CẢNH BÁO: Payload không chứa deviceId. Bỏ qua tin nhắn này! Payload: {}", jsonPayload);
                return;
            }

            Device device = deviceRepository.findByDeviceId(data.getDeviceId())
                    .orElseThrow(() -> new AppException(ErrorCode.DEVICE_NOT_FOUND));

            SensorTelemetry entity = SensorTelemetry.builder()
                    .device(device)
                    .temperature(data.getTemperature())
                    .humidity(data.getHumidity())
                    .soilMoisture(data.getSoilMoisture())
                    .light(data.getLight())
                    .build();


            entity = repository.save(entity);


            TelemetryResponse responseDto = mapToResponse(entity);
            String jsonRedis = objectMapper.writeValueAsString(responseDto);
            redisService.setValue(REDIS_KEY_PREFIX + device.getDeviceId(), jsonRedis, 1L, TimeUnit.DAYS);

            log.info(">>> ĐÃ LƯU DỮ LIỆU CẢM BIẾN CHO [{}] VÀO DB VÀ REDIS THÀNH CÔNG!", device.getDeviceId());

        } catch (JsonProcessingException e) {
            log.error(">>> LỖI DỊCH JSON: Cấu trúc tin nhắn không hợp lệ. Lỗi: {}", e.getMessage());
        } catch (AppException e) {
            log.error(">>> LỖI NGHIỆP VỤ: {}", e.getMessage());
        } catch (Exception e) {
            log.error(">>> LỖI HỆ THỐNG KHÔNG XÁC ĐỊNH: {}", e.getMessage(), e);
        }
    }


    public TelemetryResponse getLatestTelemetry(String deviceId) {
        String cachedData = redisService.getValue(REDIS_KEY_PREFIX + deviceId);
        if (cachedData != null) {
            try {
                return objectMapper.readValue(cachedData, TelemetryResponse.class);
            } catch (JsonProcessingException e) {
                log.error("Lỗi Parse JSON từ Redis: {}", e.getMessage());
            }
        }

        deviceRepository.findByDeviceId(deviceId)
                .orElseThrow(() -> new AppException(ErrorCode.DEVICE_NOT_FOUND));

        SensorTelemetry telemetry = repository.findTopByDevice_DeviceIdOrderByCreatedAtDesc(deviceId)
                .orElseThrow(() -> new AppException(ErrorCode.NO_TELEMETRY_DATA));

        TelemetryResponse response = mapToResponse(telemetry);

        try {
            redisService.setValue(REDIS_KEY_PREFIX + deviceId, objectMapper.writeValueAsString(response), 1L, TimeUnit.DAYS);
        } catch (JsonProcessingException e) {
            log.error("Lỗi lưu JSON vào Redis: {}", e.getMessage());
        }

        return response;
    }


    public Page<TelemetryResponse> getTelemetryHistory(String deviceId, int page, int size) {
        deviceRepository.findByDeviceId(deviceId)
                .orElseThrow(() -> new AppException(ErrorCode.DEVICE_NOT_FOUND));

        Pageable pageable = PageRequest.of(page, size);

        return repository.findByDevice_DeviceIdOrderByCreatedAtDesc(deviceId, pageable)
                .map(this::mapToResponse);
    }

    private TelemetryResponse mapToResponse(SensorTelemetry entity) {
        return TelemetryResponse.builder()
                .id(entity.getId())
                .deviceId(entity.getDevice().getDeviceId())
                .temperature(entity.getTemperature())
                .humidity(entity.getHumidity())
                .soilMoisture(entity.getSoilMoisture())
                .light(entity.getLight())
                .createdAt(entity.getCreatedAt())
                .build();
    }
}