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

    @Transactional
    public ControlResponse sendControlCommand(ControlRequest request) {

        Device device = deviceRepository.findByDeviceIdAndActiveTrue(request.getDeviceId())
                .orElseThrow(() -> new AppException(ErrorCode.DEVICE_NOT_FOUND));


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
            String jsonPayload = objectMapper.writeValueAsString(request);
            mqttGateway.sendToMqtt(jsonPayload);
            log.info(">>> ĐÃ GỬI LỆNH ĐIỀU KHIỂN: {}", jsonPayload);

            return ControlResponse.builder()
                    .deviceId(request.getDeviceId())
                    .command(request.getCommand())
                    .action(request.getAction())
                    .createdAt(actionLogSaved.getCreatedAt())
                    .build();
        } catch (Exception e) {
            log.error(">>> LỖI GỬI LỆNH MQTT: {}", e.getMessage());
            // Ném exception để Transactional tự động Rollback (huỷ cập nhật linh kiện và lịch sử nếu mạng rớt)
            throw new RuntimeException("Không thể gửi lệnh đến Adafruit IO");
        }
    }
}