package com.yolofarm.yolofarm_service.repository;

import com.yolofarm.yolofarm_service.entity.DeviceAction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;

@Repository
public interface DeviceActionRepository extends JpaRepository<DeviceAction, Long> {
    @Query("SELECT a FROM DeviceAction a WHERE a.device.deviceId = :deviceId " +
            "AND (:startDate IS NULL OR a.createdAt >= :startDate) " +
            "AND (:endDate IS NULL OR a.createdAt <= :endDate) " +
            "ORDER BY a.createdAt DESC")
    Page<DeviceAction> getActionLogs(
            @Param("deviceId") String deviceId,
            @Param("startDate") LocalDateTime startDate,
            @Param("endDate") LocalDateTime endDate,
            Pageable pageable
    );
}
