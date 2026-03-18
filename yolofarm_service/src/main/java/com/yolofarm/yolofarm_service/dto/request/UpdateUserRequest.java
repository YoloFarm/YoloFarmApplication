package com.yolofarm.yolofarm_service.dto.request;

import com.yolofarm.yolofarm_service.enums.Role;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.util.Set;


@Builder
@Data
@FieldDefaults(level = AccessLevel.PRIVATE)
public class UpdateUserRequest {
    String firstName;
    String lastName;
    String password;
    Role role;
}
