package com.yolofarm.yolofarm_service.repository;

import com.yolofarm.yolofarm_service.entity.SensorTelemetry;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SensorTelemetryRepository extends JpaRepository<SensorTelemetry, Long> {
    // 1. Lấy 1 bản ghi mới nhất của một thiết bị (Order By CreatedAt Desc limit 1)
    Optional<SensorTelemetry> findTopByDevice_DeviceIdOrderByCreatedAtDesc(String deviceId);

    // 2. Lấy danh sách lịch sử của thiết bị, có phân trang, sắp xếp mới nhất lên đầu
    Page<SensorTelemetry> findByDevice_DeviceIdOrderByCreatedAtDesc(String deviceId, Pageable pageable);
}
