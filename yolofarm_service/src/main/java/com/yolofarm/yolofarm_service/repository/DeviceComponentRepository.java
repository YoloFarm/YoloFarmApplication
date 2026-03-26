package com.yolofarm.yolofarm_service.repository;

import com.yolofarm.yolofarm_service.entity.DeviceComponent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DeviceComponentRepository extends JpaRepository<DeviceComponent, Long> {

    Optional<DeviceComponent> findByDevice_DeviceIdAndCodeNameAndActiveTrue(String deviceId, String codeName);

    List<DeviceComponent> findAllByDevice_DeviceIdAndActiveTrue(String deviceId);

    Optional<DeviceComponent> findByIdAndActiveTrue(Long id);
}