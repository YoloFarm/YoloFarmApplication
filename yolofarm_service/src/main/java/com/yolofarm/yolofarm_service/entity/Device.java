package com.yolofarm.yolofarm_service.entity;

import com.yolofarm.yolofarm_service.enums.DeviceStatus;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "devices")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Device extends BaseAuditingEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String deviceId;

    @Column(nullable = false)
    private String name;

    private DeviceStatus status;

    private boolean active;
}