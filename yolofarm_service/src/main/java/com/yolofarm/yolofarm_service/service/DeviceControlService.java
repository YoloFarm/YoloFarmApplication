package com.yolofarm.yolofarm_service.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.yolofarm.yolofarm_service.configuration.MqttGateway;
import com.yolofarm.yolofarm_service.dto.request.ControlRequest;
import com.yolofarm.yolofarm_service.dto.response.ControlResponse;
import com.yolofarm.yolofarm_service.entity.Device;
import com.yolofarm.yolofarm_service.entity.DeviceAction;
import com.yolofarm.yolofarm_service.exception.AppException;
import com.yolofarm.yolofarm_service.exception.ErrorCode;
import com.yolofarm.yolofarm_service.repository.DeviceActionRepository;
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
    private final DeviceActionRepository actionRepository;
    private final MqttGateway mqttGateway;
    private final ObjectMapper objectMapper;

    @Transactional
    public ControlResponse sendControlCommand(ControlRequest request) {
        // 1. Kiểm tra xem thiết bị có tồn tại (và đang active) không
        Device device = deviceRepository.findByDeviceId(request.getDeviceId())
                .orElseThrow(() -> new AppException(ErrorCode.DEVICE_NOT_FOUND));

        if (!device.isActive()) {
            throw new AppException(ErrorCode.DEVICE_NOT_FOUND); // Xóa mềm rồi thì ko cho điều khiển
        }


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
            // Ném lỗi ra để Transactional rollback lại cái log trong DB (gửi xịt thì ko lưu lịch sử)
            throw new RuntimeException("Không thể gửi lệnh đến Adafruit IO");
        }
    }
}