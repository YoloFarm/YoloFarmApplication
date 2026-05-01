package com.yolofarm.yolofarm_service.configuration;

import com.yolofarm.yolofarm_service.entity.User;
import com.yolofarm.yolofarm_service.enums.Role;
import com.yolofarm.yolofarm_service.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
@RequiredArgsConstructor
@Slf4j
public class ApplicationInitConfig {
    private final PasswordEncoder passwordEncoder;

    @Bean
    ApplicationRunner applicationRunner(UserRepository userRepository) {
        return args -> {
            // Sửa thành findByEmail và dùng 1 email đại diện cho hệ thống
            if(userRepository.findByEmail("admin@yolofarm.com").isEmpty()) {
                User user = User.builder()
                        .email("admin@yolofarm.com") // Đổi username thành email
                        .passwordHash(passwordEncoder.encode("admin")) // Pass vẫn để "admin" cho lẹ
                        .active(true)
                        .role(Role.ADMIN)
                        .build();

                userRepository.save(user);

                log.warn(">>> Created default ADMIN account (Email: admin@yolofarm.com | Pass: admin)");
            }
        };
    }
}