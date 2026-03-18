package com.yolofarm.yolofarm_service.dto.request;

import com.yolofarm.yolofarm_service.enums.Role;
import lombok.*;
import lombok.experimental.FieldDefaults;



@Builder
@Data
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CreateUserRequest {
    String username;
    String password;
    String firstName;
    String lastName;
    Role role;
}