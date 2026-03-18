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
public class SensorTelemetry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "device_id")
    private Device device;

    // Khớp với JSON { "temperature": 32.5, "humidity": 60.0, "soilMoisture": 45.0, "light": 1024 }
    private Float temperature;

    private Float humidity;

    @Column(name = "soil_moisture")
    private Float soilMoisture;

    @Column(name = "light")
    private Integer light;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}