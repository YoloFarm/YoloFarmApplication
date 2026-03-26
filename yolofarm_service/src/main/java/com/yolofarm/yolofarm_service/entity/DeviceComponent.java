package com.yolofarm.yolofarm_service.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "device_components")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DeviceComponent extends BaseAuditingEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "device_id", nullable = false)
    private Device device;

    // Tên hiển thị trên App cho người dùng xem (VD: "Máy bơm khu A", "Đèn sưởi")
    @Column(nullable = false)
    private String name;

    // Mã linh kiện để hệ thống gửi MQTT (VD: "PUMP_1", "LED_1")
    // Phải khớp với cái chữ "command" mà mạch Yolo:Bit chờ nhận
    @Column(nullable = false)
    private String codeName;

    // Trạng thái hiện tại của linh kiện (VD: "ON", "OFF", hoặc "50" cho tốc độ quạt)
    @Column(nullable = false)
    private String status;

    @Column(nullable = false)
    @Builder.Default
    private boolean active = true;
}