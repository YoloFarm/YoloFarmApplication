package com.yolofarm.yolofarm_service.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "device_actions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DeviceAction extends BaseAuditingEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "device_id", nullable = false)
    private Device device;

    @Column(nullable = false)
    private String command; // Tên lệnh (VD: PUMP, FAN, LED)

    @Column(nullable = false)
    private String action; // Hành động (VD: ON, OFF, 50%)

}