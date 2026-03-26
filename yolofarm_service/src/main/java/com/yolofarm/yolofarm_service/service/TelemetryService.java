package com.yolofarm.yolofarm_service.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yolofarm.yolofarm_service.dto.payload.TelemetryPayload;
import com.yolofarm.yolofarm_service.dto.request.TelemetryResponse;
import com.yolofarm.yolofarm_service.entity.Device;
import com.yolofarm.yolofarm_service.entity.DeviceAction;
import com.yolofarm.yolofarm_service.entity.DeviceComponent;
import com.yolofarm.yolofarm_service.entity.SensorTelemetry;
import com.yolofarm.yolofarm_service.exception.AppException;
import com.yolofarm.yolofarm_service.exception.ErrorCode;
import com.yolofarm.yolofarm_service.repository.DeviceActionRepository;
import com.yolofarm.yolofarm_service.repository.DeviceComponentRepository;
import com.yolofarm.yolofarm_service.repository.DeviceRepository;
import com.yolofarm.yolofarm_service.repository.SensorTelemetryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class TelemetryService {

    private final SensorTelemetryRepository repository;
    private final DeviceRepository deviceRepository;
    private final DeviceComponentRepository componentRepository;
    private final DeviceActionRepository actionRepository;
    private final ObjectMapper objectMapper;
    private final RedisService redisService;


    private static final String REDIS_KEY_PREFIX = "telemetry:latest:";

    @Transactional
    public void processAndSave(String jsonPayload) {
        try {
            // Bước 1: Đọc JSON dưới dạng Cây (Tree) để soi các trường bên trong
            JsonNode rootNode = objectMapper.readTree(jsonPayload);

            if (!rootNode.has("deviceId") || rootNode.get("deviceId").asText().isBlank()) {
                log.warn(">>> CẢNH BÁO: Payload không chứa deviceId. Bỏ qua tin nhắn này! Payload: {}", jsonPayload);
                return;
            }

            // Bước 2: RẼ NHÁNH LOGIC DỰA VÀO LOẠI TIN NHẮN
            // Nếu mạch Yolo:Bit báo cáo gạt công tắc tay (Gửi type = STATE_UPDATE)
            if (rootNode.has("type") && "STATE_UPDATE".equals(rootNode.get("type").asText())) {
                handleStateUpdate(rootNode);
            }
            // Nếu không có type, mặc định hiểu là gửi thông số cảm biến (Nhiệt độ, độ ẩm...)
            else {
                handleTelemetry(rootNode);
            }

        } catch (JsonProcessingException e) {
            log.error(">>> LỖI DỊCH JSON: Cấu trúc tin nhắn không hợp lệ. Lỗi: {}", e.getMessage());
        } catch (AppException e) {
            log.error(">>> LỖI NGHIỆP VỤ: {}", e.getMessage());
        } catch (Exception e) {
            log.error(">>> LỖI HỆ THỐNG KHÔNG XÁC ĐỊNH: {}", e.getMessage(), e);
        }
    }

    // =========================================================================
    // HÀM XỬ LÝ 1: CẬP NHẬT TRẠNG THÁI KHI GẠT CÔNG TẮC TAY
    // =========================================================================
    private void handleStateUpdate(JsonNode node) {
        String deviceId = node.get("deviceId").asText();
        String command = node.get("command").asText(); // VD: PUMP_1
        String action = node.get("action").asText();   // VD: ON

        // ĐÃ SỬA: Dùng trực tiếp các biến chuỗi vừa moi ra từ JsonNode
        Device device = deviceRepository.findByDeviceIdAndActiveTrue(deviceId)
                .orElseThrow(() -> new AppException(ErrorCode.DEVICE_NOT_FOUND));

        // ĐÃ SỬA: Dùng trực tiếp deviceId và command
        DeviceComponent component = componentRepository.findByDevice_DeviceIdAndCodeNameAndActiveTrue(deviceId, command)
                .orElseThrow(() -> new AppException(ErrorCode.DEVICE_COMPONENT_NOT_FOUND));

        component.setStatus(action);
        componentRepository.save(component);

        DeviceAction actionLog = DeviceAction.builder()
                .device(device)
                .command(command)
                .action(action)
                .build();
        actionRepository.save(actionLog);

        log.info(">>> ĐÃ ĐỒNG BỘ TRẠNG THÁI TỪ PHẦN CỨNG: Thiết bị [{}], Linh kiện [{}], Trạng thái [{}]", deviceId, command, action);
    }


    private void handleTelemetry(JsonNode node) throws JsonProcessingException {
        TelemetryPayload data = objectMapper.treeToValue(node, TelemetryPayload.class);

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