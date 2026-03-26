package com.yolofarm.yolofarm_service.repository;

import com.yolofarm.yolofarm_service.entity.Device;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface DeviceRepository extends JpaRepository<Device, Long> {
    boolean existsByDeviceId(String deviceId);

    Page<Device> findAllByActiveTrue(Pageable pageable);

    Optional<Device> findByDeviceId(String deviceId);

    Optional<Device> findByDeviceIdAndActiveTrue(String deviceId);

    Optional<Device> findByIdAndActiveTrue(Long id);

}
