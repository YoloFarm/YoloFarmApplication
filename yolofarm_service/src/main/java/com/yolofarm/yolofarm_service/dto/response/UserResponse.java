package com.yolofarm.yolofarm_service.dto.response;

import com.yolofarm.yolofarm_service.enums.Role;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.util.Set;


@Builder
@Data
@FieldDefaults(level = AccessLevel.PRIVATE)
public class UserResponse {
    String id;
    String username;
    String password;
    String firstName;
    String lastName;
    Role role;
    boolean active;
}