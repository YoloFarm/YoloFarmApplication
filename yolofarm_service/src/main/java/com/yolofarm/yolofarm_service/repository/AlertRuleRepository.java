package com.yolofarm.yolofarm_service.repository;

import com.yolofarm.yolofarm_service.entity.AlertRule;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface AlertRuleRepository extends JpaRepository<AlertRule, Long> {
    List<AlertRule> findByDeviceIdAndSensorTypeAndActiveTrue(String deviceId, String sensorType);
    List<AlertRule> findByDeviceIdAndActiveTrue(String deviceId);
}