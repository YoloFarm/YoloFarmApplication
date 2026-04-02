package com.yolofarm.yolofarm_service.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yolofarm.yolofarm_service.dto.response.TelemetryResponse;
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

import java.util.Set;
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

    private static final Set<String> SENSOR_METRICS = Set.of("TEMP", "HUMIDITY", "SOIL_MOISTURE", "LIGHT");

    @Transactional
    public void processAndSave(String topic, String payload) {
        try {
            // Bước 1: Lấy tên Feed từ Topic (VD: "canhoangha/feeds/yolo001-temp" -> "yolo001-temp")
            String feedName = topic.substring(topic.lastIndexOf("/") + 1);
            if (feedName.matches("\\d+") || !feedName.equals(feedName.toLowerCase())) {
                return;
            }
            // Bước 2: Tách lấy mã thiết bị và loại cảm biến.
            // GIẢ SỬ quy tắc đặt tên của team IoT là: [mã_thiết_bị]-[chỉ_số] (VD: yolo001-temp)
            String[] parts = feedName.split("-");
            if (parts.length < 2) {
                log.warn("Bỏ qua feed không đúng định dạng: {}", feedName);
                return;
            }

            // Map lại mã thiết bị cho khớp DB (VD: yolo001 -> YOLO-001)
            String rawDeviceId = parts[0].toUpperCase();
            String deviceId = rawDeviceId.substring(0, 4) + "-" + rawDeviceId.substring(4);
            String metric = parts[1].toUpperCase(); // TEMP, HUMIDITY, PUMP1...

            // Bước 3: Rẽ nhánh xử lý dựa trên loại metric
            if (SENSOR_METRICS.contains(metric)) {
                // Nếu tên feed thuộc nhóm cảm biến (Ví dụ: TEMP, LIGHT)
                Double value = Double.parseDouble(payload);
                handleTelemetry(deviceId, metric, value);
            } else {
                // Nếu không thuộc nhóm cảm biến, mặc định nó là Linh kiện (Ví dụ: PUMP1, FAN)
                // Lúc này mới được phép quy đổi 0/1 thành ON/OFF
                String action = (payload.equals("1") || payload.equalsIgnoreCase("ON")) ? "ON" : "OFF";
                handleStateUpdate(deviceId, metric, action);
            }

        } catch (Exception e) {
            log.error(">>> LỖI XỬ LÝ MQTT ĐỘC LẬP: {}", e.getMessage(), e);
        }
    }

    private void handleStateUpdate(String deviceId, String command, String action) {
        Device device = deviceRepository.findByDeviceIdAndActiveTrue(deviceId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy thiết bị: " + deviceId));

        DeviceComponent component = componentRepository.findByDevice_DeviceIdAndCodeNameAndActiveTrue(deviceId, command)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy linh kiện: " + command));

        if (component.getStatus().equalsIgnoreCase(action)) {
            log.info(">>> [ECHO] Bỏ qua bản tin từ phần cứng vì linh kiện [{}] đã ở trạng thái [{}]", command, action);
            return;
        }

        component.setStatus(action);
        componentRepository.save(component);

        DeviceAction actionLog = DeviceAction.builder()
                .device(device)
                .command(command)
                .action(action)
                .build();
        actionRepository.save(actionLog);

        log.info(">>> ĐỒNG BỘ PHẦN CỨNG: Thiết bị [{}], Linh kiện [{}], Trạng thái [{}]", deviceId, command, action);
    }

    private void handleTelemetry(String deviceId, String sensorType, Double value) {
        Device device = deviceRepository.findByDeviceIdAndActiveTrue(deviceId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy thiết bị: " + deviceId));

        SensorTelemetry entity = SensorTelemetry.builder()
                .device(device)
                .sensorType(sensorType)
                .value(value)
                .build();

        repository.save(entity);
        log.info(">>> LƯU CẢM BIẾN: Thiết bị [{}], Loại [{}], Giá trị [{}]", deviceId, sensorType, value);

        String cacheKey = REDIS_KEY_PREFIX + deviceId + ":" + sensorType;
        redisService.deleteValue(cacheKey);
    }


    public TelemetryResponse getLatestTelemetry(String deviceId, String sensorType) {

        // Cache Key giờ phải kẹp thêm sensorType: "telemetry:latest:YOLO-001:TEMP"
        String cacheKey = REDIS_KEY_PREFIX + deviceId + ":" + sensorType;
        String cachedData = redisService.getValue(cacheKey);

        if (cachedData != null) {
            try {
                return objectMapper.readValue(cachedData, TelemetryResponse.class);
            } catch (JsonProcessingException e) {
                log.error("Lỗi Parse JSON từ Redis: {}", e.getMessage());
            }
        }

        deviceRepository.findByDeviceIdAndActiveTrue(deviceId)
                .orElseThrow(() -> new AppException(ErrorCode.DEVICE_NOT_FOUND));

        // Phải viết thêm hàm findTop... trong Repository để hỗ trợ tìm theo sensorType
        SensorTelemetry telemetry = repository.findTopByDevice_DeviceIdAndSensorTypeOrderByCreatedAtDesc(deviceId, sensorType)
                .orElseThrow(() -> new AppException(ErrorCode.NO_TELEMETRY_DATA));

        TelemetryResponse response = mapToResponse(telemetry);

        try {
            redisService.setValue(cacheKey, objectMapper.writeValueAsString(response), 1L, TimeUnit.DAYS);
        } catch (JsonProcessingException e) {
            log.error("Lỗi lưu JSON vào Redis: {}", e.getMessage());
        }

        return response;
    }

    // 2. Lấy lịch sử của MỘT LOẠI CẢM BIẾN (Để vẽ biểu đồ trên Web)
    public Page<TelemetryResponse> getTelemetryHistory(String deviceId, String sensorType, int page, int size) {
        deviceRepository.findByDeviceIdAndActiveTrue(deviceId)
                .orElseThrow(() -> new AppException(ErrorCode.DEVICE_NOT_FOUND));

        Pageable pageable = PageRequest.of(page, size);

        // Phải viết thêm hàm findBy... trong Repository
        return repository.findByDevice_DeviceIdAndSensorTypeOrderByCreatedAtDesc(deviceId, sensorType, pageable)
                .map(this::mapToResponse);
    }

    // 3. Hàm Map chuẩn cho Bảng dọc
    private TelemetryResponse mapToResponse(SensorTelemetry entity) {
        return TelemetryResponse.builder()
                .id(entity.getId())
                .deviceId(entity.getDevice().getDeviceId())
                .sensorType(entity.getSensorType())
                .value(entity.getValue())
                .createdAt(entity.getCreatedAt())
                .build();
    }
}