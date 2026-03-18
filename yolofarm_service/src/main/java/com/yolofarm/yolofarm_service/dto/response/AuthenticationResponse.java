package com.yolofarm.yolofarm_service.dto.response;

import com.yolofarm.yolofarm_service.enums.Role;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.util.Set;

@Data
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AuthenticationResponse {
    String id;
    String username;
    String firstName;
    String lastName;
    Role role;

    String token;
    boolean authenticated;
}