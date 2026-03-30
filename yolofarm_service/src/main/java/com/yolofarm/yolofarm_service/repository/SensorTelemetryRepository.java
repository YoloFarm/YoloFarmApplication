package com.yolofarm.yolofarm_service.repository;

import com.yolofarm.yolofarm_service.entity.SensorTelemetry;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SensorTelemetryRepository extends JpaRepository<SensorTelemetry, Long> {
    // Tìm giá trị MỚI NHẤT của 1 loại cảm biến trên 1 thiết bị
    Optional<SensorTelemetry> findTopByDevice_DeviceIdAndSensorTypeOrderByCreatedAtDesc(String deviceId, String sensorType);

    // Tìm lịch sử (phân trang) của 1 loại cảm biến trên 1 thiết bị
    Page<SensorTelemetry> findByDevice_DeviceIdAndSensorTypeOrderByCreatedAtDesc(String deviceId, String sensorType, Pageable pageable);
}
