package com.yolofarm.yolofarm_service.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;

    @Async // Bắn mail bất đồng bộ, không bắt luồng chính phải chờ
    public void sendAlertEmailAsync(String to, String subject, String text) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom("YoloFarm Smart IoT <noreply@yolofarm.com>");
            message.setTo(to);
            message.setSubject(subject);
            message.setText(text);

            mailSender.send(message);
            log.info(">>> ĐÃ BẮN EMAIL CẢNH BÁO THÀNH CÔNG ĐẾN: {}", to);
        } catch (Exception e) {
            log.error(">>> LỖI GỬI EMAIL ĐẾN {}: {}", to, e.getMessage());
        }
    }
}