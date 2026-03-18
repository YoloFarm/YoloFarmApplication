package com.yolofarm.yolofarm_service.repository;

import com.yolofarm.yolofarm_service.entity.DeviceAction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DeviceActionRepository extends JpaRepository<DeviceAction, Long> {
}
