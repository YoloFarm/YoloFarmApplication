package com.yolofarm.yolofarm_service.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "alert_rules")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AlertRule extends BaseAuditingEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String deviceId;     // VD: YOLO-001

    @Column(nullable = false)
    private String sensorType;   // VD: TEMP, SOIL_MOISTURE

    @Column(nullable = false)
    private String operator;     // VD: GREATER_THAN, LESS_THAN, EQUAL

    @Column(nullable = false)
    private Double threshold;    // VD: 40.0

    private String alertMessage; // VD: "Nhiệt độ nhà kính đang quá cao!"

    @Builder.Default
    private boolean active = true;
}