package com.yolofarm.yolofarm_service.service;

import com.yolofarm.yolofarm_service.dto.request.AlertRuleRequest;
import com.yolofarm.yolofarm_service.dto.response.AlertRuleResponse;
import com.yolofarm.yolofarm_service.entity.AlertRule;
import com.yolofarm.yolofarm_service.entity.Device;
import com.yolofarm.yolofarm_service.exception.AppException;
import com.yolofarm.yolofarm_service.exception.ErrorCode;
import com.yolofarm.yolofarm_service.repository.AlertRuleRepository;
import com.yolofarm.yolofarm_service.repository.DeviceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AlertRuleService {

    private final AlertRuleRepository ruleRepository;
    private final DeviceRepository deviceRepository;

    private void checkDeviceOwnership(Device device) {
        String currentEmail = SecurityContextHolder.getContext().getAuthentication().getName();
        boolean isAdmin = SecurityContextHolder.getContext().getAuthentication().getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));

        if (!isAdmin && !currentEmail.equals(device.getOwnerEmail())) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }
    }

    public AlertRuleResponse createRule(AlertRuleRequest request) {
        Device device = deviceRepository.findByDeviceIdAndActiveTrue(request.getDeviceId())
                .orElseThrow(() -> new AppException(ErrorCode.DEVICE_NOT_FOUND));

        checkDeviceOwnership(device);

        AlertRule rule = AlertRule.builder()
                .deviceId(request.getDeviceId())
                .sensorType(request.getSensorType())
                .operator(request.getOperator())
                .threshold(request.getThreshold())
                .alertMessage(request.getAlertMessage())
                .active(true)
                .build();

        rule = ruleRepository.save(rule);

        return mapToResponse(rule);
    }

    public List<AlertRuleResponse> getRulesByDevice(String deviceId) {
        Device device = deviceRepository.findByDeviceIdAndActiveTrue(deviceId)
                .orElseThrow(() -> new AppException(ErrorCode.DEVICE_NOT_FOUND));

        checkDeviceOwnership(device);

        return ruleRepository.findByDeviceIdAndActiveTrue(deviceId)
                .stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public void deleteRule(Long id) {
        AlertRule rule = ruleRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.ALERT_RULE_NOT_FOUND));

        Device device = deviceRepository.findByDeviceIdAndActiveTrue(rule.getDeviceId()).get();
        checkDeviceOwnership(device);

        rule.setActive(false);
        ruleRepository.save(rule);
    }


    private AlertRuleResponse mapToResponse(AlertRule entity) {
        return AlertRuleResponse.builder()
                .id(entity.getId())
                .deviceId(entity.getDeviceId())
                .sensorType(entity.getSensorType())
                .operator(entity.getOperator())
                .threshold(entity.getThreshold())
                .alertMessage(entity.getAlertMessage())
                .active(entity.isActive())
                .build();
    }
}