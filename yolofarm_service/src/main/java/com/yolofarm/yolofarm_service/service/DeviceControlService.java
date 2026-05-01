package com.yolofarm.yolofarm_service.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.yolofarm.yolofarm_service.configuration.MqttGateway;
import com.yolofarm.yolofarm_service.dto.request.ControlRequest;
import com.yolofarm.yolofarm_service.dto.response.ControlResponse;
import com.yolofarm.yolofarm_service.entity.Device;
import com.yolofarm.yolofarm_service.entity.DeviceAction;
import com.yolofarm.yolofarm_service.entity.DeviceComponent;
import com.yolofarm.yolofarm_service.exception.AppException;
import com.yolofarm.yolofarm_service.exception.ErrorCode;
import com.yolofarm.yolofarm_service.repository.DeviceActionRepository;
import com.yolofarm.yolofarm_service.repository.DeviceComponentRepository;
import com.yolofarm.yolofarm_service.repository.DeviceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class DeviceControlService {

    private final DeviceRepository deviceRepository;
    private final DeviceComponentRepository componentRepository;
    private final DeviceActionRepository actionRepository;
    private final MqttGateway mqttGateway;
    private final ObjectMapper objectMapper;

    @Value("${adafruit.mqtt.username}")
    private String adafruitUsername;

    @Transactional
    public ControlResponse sendControlCommand(ControlRequest request) {

        Device device = deviceRepository.findByDeviceIdAndActiveTrue(request.getDeviceId())
                .orElseThrow(() -> new AppException(ErrorCode.DEVICE_NOT_FOUND));

        // ==========================================
        // DATA-LEVEL RBAC: KIỂM TRA QUYỀN ĐIỀU KHIỂN
        // ==========================================
        var authentication = SecurityContextHolder.getContext().getAuthentication();

        // CHỈ KIỂM TRA QUYỀN NẾU CÓ NGƯỜI DÙNG THẬT GỌI API (Bỏ qua nếu là hệ thống chạy ngầm)
        if (authentication != null && authentication.isAuthenticated() && !authentication.getPrincipal().equals("anonymousUser")) {
            String currentEmail = authentication.getName();
            boolean isAdmin = authentication.getAuthorities().stream()
                    .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));

            if (!isAdmin && !currentEmail.equals(device.getOwnerEmail())) {
                log.warn(">>> XÂM NHẬP TRÁI PHÉP: User [{}] cố điều khiển thiết bị [{}]", currentEmail, device.getDeviceId());
                throw new AppException(ErrorCode.UNAUTHORIZED);
            }
        }
        // ==========================================

        DeviceComponent component = componentRepository.findByDevice_DeviceIdAndCodeNameAndActiveTrue(request.getDeviceId(), request.getCommand())
                .orElseThrow(() -> new AppException(ErrorCode.DEVICE_COMPONENT_NOT_FOUND));

        component.setStatus(request.getAction());

        DeviceAction actionLog = DeviceAction.builder()
                .device(device)
                .command(request.getCommand())
                .action(request.getAction())
                .build();
        DeviceAction actionLogSaved = actionRepository.save(actionLog);

        try {
            String feedName = request.getDeviceId().toLowerCase().replace("-", "") + "-" + request.getCommand().toLowerCase();
            String dynamicTopic = adafruitUsername + "/feeds/" + feedName;
            String payloadToSend = request.getAction();

            mqttGateway.sendToMqtt(dynamicTopic, payloadToSend);
            log.info(">>> ĐÃ GỬI LỆNH ĐIỀU KHIỂN XUỐNG FEED [{}]: {}", dynamicTopic, payloadToSend);

            return ControlResponse.builder()
                    .deviceId(request.getDeviceId())
                    .command(request.getCommand())
                    .action(request.getAction())
                    .createdAt(actionLogSaved.getCreatedAt())
                    .build();
        } catch (Exception e) {
            log.error(">>> LỖI GỬI LỆNH MQTT: {}", e.getMessage());
            throw new RuntimeException("Không thể gửi lệnh đến Adafruit IO");
        }
    }
}