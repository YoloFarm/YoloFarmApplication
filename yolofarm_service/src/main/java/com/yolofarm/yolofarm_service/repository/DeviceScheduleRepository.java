package com.yolofarm.yolofarm_service.repository;

import com.yolofarm.yolofarm_service.entity.DeviceSchedule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DeviceScheduleRepository extends JpaRepository<DeviceSchedule, Long> {
    List<DeviceSchedule> findAllByDeviceIdAndActiveTrue(String deviceId);
    List<DeviceSchedule> findAllByActiveTrue();
}