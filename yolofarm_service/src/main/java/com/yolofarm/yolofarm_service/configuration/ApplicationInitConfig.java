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

import java.util.HashSet;
import java.util.Set;

@Configuration
@RequiredArgsConstructor
@Slf4j
public class ApplicationInitConfig {
    private final PasswordEncoder passwordEncoder;

    @Bean
    ApplicationRunner applicationRunner(UserRepository userRepository) {
        return args -> {
            if(userRepository.findByUsername("admin").isEmpty()) {
                User user = User.builder()
                        .username("admin")
                        .passwordHash(passwordEncoder.encode("admin"))
                        .active(true)
                        .role(Role.ADMIN)
                        .build();

                userRepository.save(user);

                log.warn("Created ADMIN");
            }
        };
    }
}