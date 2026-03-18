package com.yolofarm.yolofarm_service.entity;

import com.yolofarm.yolofarm_service.enums.Role;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User extends BaseAuditingEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(unique = true, nullable = false)
    private String username;

    @Column(nullable = false)
    private String passwordHash;

    private String firstName;
    private String lastName;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private Role role;

    private boolean active;
}