package com.yolofarm.yolofarm_service.entity;

import jakarta.persistence.*;
        import lombok.*;
        import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "sensor_telemetry")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SensorTelemetry extends BaseAuditingEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "device_id", nullable = false)
    private Device device;

    // Tên loại cảm biến: "TEMPERATURE", "HUMIDITY", "SOIL_MOISTURE"
    @Column(nullable = false)
    private String sensorType;

    // Giá trị đo được (Lưu kiểu Double để bao trọn mọi loại số)
    @Column(nullable = false)
    private Double value;
}