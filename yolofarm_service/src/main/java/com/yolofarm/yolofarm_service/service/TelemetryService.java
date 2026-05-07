package com.yolofarm.yolofarm_service.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yolofarm.yolofarm_service.dto.response.TelemetryResponse;
import com.yolofarm.yolofarm_service.entity.*;
import com.yolofarm.yolofarm_service.exception.AppException;
import com.yolofarm.yolofarm_service.exception.ErrorCode;
import com.yolofarm.yolofarm_service.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class TelemetryService {

    private final EmailService emailService;
    private final AlertRuleRepository alertRuleRepository;
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
                // LINH KIỆN ĐIỀU KHIỂN (Quạt, Bơm, Đèn...)
                String action;
                String cleanPayload = payload.trim().toUpperCase();

                if (cleanPayload.equals("1") || cleanPayload.equals("ON")) {
                    action = "ON";
                } else if (cleanPayload.equals("0") || cleanPayload.equals("OFF")) {
                    action = "OFF";
                } else {
                    // ===============================================
                    // HỖ TRỢ ANALOG/PWM Ở ĐÂY:
                    // Nếu payload gửi xuống là "50", "75" (không phải ON/OFF/0/1)
                    // thì giữ nguyên con số đó để lưu vào Database
                    // ===============================================
                    action = cleanPayload;
                }

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

        evaluateAlertRules(device, sensorType, value);
    }

    private void evaluateAlertRules(Device device, String sensorType, Double value) {
        // Nếu thiết bị chưa có chủ, khỏi gửi mail
        if (device.getOwnerEmail() == null) return;

        List<AlertRule> rules = alertRuleRepository.findByDeviceIdAndSensorTypeAndActiveTrue(device.getDeviceId(), sensorType);

        for (AlertRule rule : rules) {

            boolean isTriggered = switch (rule.getOperator().toUpperCase()) {
                case "GREATER_THAN" -> value > rule.getThreshold();
                case "LESS_THAN" -> value < rule.getThreshold();
                case "EQUAL" -> value.equals(rule.getThreshold());
                default -> false;
            };

            if (isTriggered) {
                // REDIS ANTI-SPAM: Khóa cảnh báo này trong vòng 30 phút
                String cooldownKey = "alert:cooldown:" + rule.getId();

                if (redisService.getValue(cooldownKey) == null) {

                    String subject = "[Khẩn Cấp] Cảnh báo từ thiết bị " + device.getDeviceId();
                    String message = String.format("Cảnh báo: %s\nLoại cảm biến: %s\nGiá trị đo được hiện tại: %s\nNgưỡng cài đặt: %s %s",
                            rule.getAlertMessage(), sensorType, value, rule.getOperator(), rule.getThreshold());

                    // Bắn Mail cho chủ sở hữu
                    emailService.sendAlertEmailAsync(device.getOwnerEmail(), subject, message);

                    // Set cờ Cooldown 30 phút
                    redisService.setValue(cooldownKey, "LOCKED", 30L, TimeUnit.MINUTES);
                    log.info(">>> Đã kích hoạt luật cảnh báo ID: {}. Cấm làm phiền trong 30 phút tiếp theo.", rule.getId());
                }
            }
        }
    }

    // =======================================================
    // HÀM HELPER: KIỂM TRA QUYỀN SỞ HỮU (RBAC)
    // =======================================================
    private void checkDeviceOwnership(Device device) {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        String currentEmail = authentication.getName();
        boolean isAdmin = authentication.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));

        // Nếu KHÔNG phải Admin và cũng KHÔNG phải chủ sở hữu -> Cấm xem data!
        if (!isAdmin && !currentEmail.equals(device.getOwnerEmail())) {
            log.warn(">>> XÂM NHẬP TRÁI PHÉP: User [{}] cố xem dữ liệu thiết bị [{}]", currentEmail, device.getDeviceId());
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }
    }


    public Map<String, TelemetryResponse> getLatestTelemetryAll(String deviceId) {
        // BƯỚC 1: Lấy Device và KIỂM TRA QUYỀN (Chỉ cần làm 1 lần cho cả request)
        Device device = deviceRepository.findByDeviceIdAndActiveTrue(deviceId)
                .orElseThrow(() -> new AppException(ErrorCode.DEVICE_NOT_FOUND));

        checkDeviceOwnership(device);

        // Khởi tạo Map để chứa kết quả của 4 loại sensor
        Map<String, TelemetryResponse> result = new HashMap<>();

        // BƯỚC 2: Duyệt qua danh sách 4 sensor đã định nghĩa ở đầu class (SENSOR_METRICS)
        for (String sensorType : SENSOR_METRICS) {
            String cacheKey = REDIS_KEY_PREFIX + deviceId + ":" + sensorType;
            String cachedData = redisService.getValue(cacheKey);

            // 2.1 Kiểm tra Cache
            if (cachedData != null) {
                try {
                    TelemetryResponse cachedResponse = objectMapper.readValue(cachedData, TelemetryResponse.class);
                    result.put(sensorType, cachedResponse);
                    continue; // Lấy được từ Cache thì bỏ qua DB, chạy tiếp sensor khác
                } catch (JsonProcessingException e) {
                    log.error("Lỗi Parse JSON từ Redis cho key {}: {}", cacheKey, e.getMessage());
                }
            }

            // 2.2 Nếu Cache rỗng, gọi xuống DB
            // LƯU Ý: Dùng ifPresent thay vì orElseThrow.
            // Đề phòng trường hợp thiết bị mới bật, gửi TEMP rồi nhưng chưa kịp gửi LIGHT, API vẫn không bị sập.
            repository.findTopByDevice_DeviceIdAndSensorTypeOrderByCreatedAtDesc(deviceId, sensorType)
                    .ifPresent(telemetry -> {
                        TelemetryResponse response = mapToResponse(telemetry);
                        result.put(sensorType, response);

                        // Lưu ngược lại vào Cache
                        try {
                            redisService.setValue(cacheKey, objectMapper.writeValueAsString(response), 1L, TimeUnit.DAYS);
                        } catch (JsonProcessingException e) {
                            log.error("Lỗi lưu JSON vào Redis cho key {}: {}", cacheKey, e.getMessage());
                        }
                    });
        }

        return result; // Trả về Map chứa tối đa 4 keys: TEMP, HUMIDITY, SOIL_MOISTURE, LIGHT
    }

    public Page<TelemetryResponse> getTelemetryHistory(String deviceId, String sensorType, int page, int size) {
        // KIỂM TRA QUYỀN
        Device device = deviceRepository.findByDeviceIdAndActiveTrue(deviceId)
                .orElseThrow(() -> new AppException(ErrorCode.DEVICE_NOT_FOUND));

        checkDeviceOwnership(device); // Chặn ngay nếu không có quyền

        Pageable pageable = PageRequest.of(page, size);

        return repository.findByDevice_DeviceIdAndSensorTypeOrderByCreatedAtDesc(deviceId, sensorType, pageable)
                .map(this::mapToResponse);
    }

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