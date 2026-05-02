package com.yolofarm.yolofarm_service.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

    @Value("${brevo.api-key}")
    private String brevoApiKey;

    private final RestTemplate restTemplate = new RestTemplate();

    @Async
    public void sendAlertEmailAsync(String to, String subject, String text) {
        String url = "https://api.brevo.com/v3/smtp/email";

        // Cấu hình Headers (Brevo dùng header 'api-key')
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));
        headers.set("api-key", brevoApiKey);

        // Khởi tạo Body
        Map<String, Object> body = new HashMap<>();

        Map<String, String> sender = new HashMap<>();
        sender.put("name", "YoloFarm System");
        sender.put("email", "cnpmhcmut@gmail.com");
        body.put("sender", sender);

        // 2. Cấu hình người nhận
        Map<String, String> recipient = new HashMap<>();
        recipient.put("email", to);
        body.put("to", List.of(recipient));

        // 3. Tiêu đề và Nội dung
        body.put("subject", subject);
        String htmlContent = String.format(
                "<h2>🚨 CẢNH BÁO TỪ YOLO-FARM</h2><p style='white-space: pre-line; font-size: 16px;'>%s</p>", text
        );
        body.put("htmlContent", htmlContent);

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);

        try {
            // Bắn API gọi Brevo
            restTemplate.postForEntity(url, request, String.class);
            log.info(">>> [BREVO] ĐÃ BẮN MAIL CẢNH BÁO THÀNH CÔNG ĐẾN: {}", to);
        } catch (Exception e) {
            log.error(">>> [BREVO] LỖI GỬI EMAIL ĐẾN {}: {}", to, e.getMessage());
        }
    }
}