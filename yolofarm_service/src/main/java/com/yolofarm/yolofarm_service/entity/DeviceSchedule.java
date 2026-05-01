package com.yolofarm.yolofarm_service.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "device_schedules")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class DeviceSchedule extends BaseAuditingEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String deviceId;

    @Column(nullable = false)
    private String command; // VD: PUMP1

    @Column(nullable = false)
    private String action;  // VD: ON, OFF

    @Column(nullable = false)
    private String cronExpression; // VD: "0 0 6 * * *" (6h sáng mỗi ngày)

    private String description;

    @Builder.Default
    private boolean active = true;
}