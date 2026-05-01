package com.yolofarm.yolofarm_service.mapper;

import com.yolofarm.yolofarm_service.dto.request.CreateUserRequest;
import com.yolofarm.yolofarm_service.dto.request.UpdateUserRequest;
import com.yolofarm.yolofarm_service.dto.response.UserResponse;
import com.yolofarm.yolofarm_service.entity.User;
import org.springframework.stereotype.Service;

import java.util.HashSet;

@Service
public class UserMapper {
    public User toUser(CreateUserRequest request) {
        return User.builder()
                .email(request.getEmail())
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .role((request.getRole()))
                .build();
    }

    public UserResponse toUserResponse(User user) {
        return UserResponse.builder()
                .id(user.getId())
                .email(user.getEmail())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .password(user.getPasswordHash())
                .role(user.getRole())
                .active(user.isActive())
                .build();
    }

    public void updateUser(UpdateUserRequest request, User user) {
        if (request.getFirstName() != null) {
            user.setFirstName(request.getFirstName());
        }

        if (request.getLastName() != null) {
            user.setLastName(request.getLastName());
        }

        if (request.getRole() != null) {
            user.setRole(request.getRole());
        }
    }
}