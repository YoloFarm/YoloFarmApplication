package com.yolofarm.yolofarm_service.configuration;
import com.yolofarm.yolofarm_service.service.TelemetryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.springframework.integration.mqtt.outbound.MqttPahoMessageHandler;
import org.springframework.messaging.MessageHandler;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.integration.annotation.ServiceActivator;
import org.springframework.integration.channel.DirectChannel;
import org.springframework.integration.core.MessageProducer;
import org.springframework.integration.mqtt.core.DefaultMqttPahoClientFactory;
import org.springframework.integration.mqtt.core.MqttPahoClientFactory;
import org.springframework.integration.mqtt.inbound.MqttPahoMessageDrivenChannelAdapter;
import org.springframework.integration.mqtt.support.DefaultPahoMessageConverter;
import org.springframework.messaging.MessageChannel;

import java.util.UUID;

@Slf4j
@Configuration
@RequiredArgsConstructor
public class MqttConfig {

    @Value("${adafruit.mqtt.url}")
    private String brokerUrl;

    @Value("${adafruit.mqtt.username}")
    private String username;

    @Value("${adafruit.mqtt.password}")
    private String password;

    @Value("${adafruit.mqtt.client-id}")
    private String clientId;

    @Value("${adafruit.mqtt.topic-telemetry}")
    private String topicTelemetry;

    @Value("${adafruit.mqtt.topic-control}")
    private String topicControl;

    private final TelemetryService telemetryService;

    // 1. Cấu hình tài khoản đăng nhập
    @Bean
    public MqttPahoClientFactory mqttClientFactory() {
        DefaultMqttPahoClientFactory factory = new DefaultMqttPahoClientFactory();
        MqttConnectOptions options = new MqttConnectOptions();
        options.setServerURIs(new String[] { brokerUrl });
        options.setUserName(username);
        options.setPassword(password.toCharArray());
        options.setAutomaticReconnect(true); // Tự động nối lại nếu rớt mạng
        options.setCleanSession(true);
        factory.setConnectionOptions(options);
        return factory;
    }

    // 2. Tạo đường ống nhận tin nhắn trong Spring Boot
    @Bean
    public MessageChannel mqttInputChannel() {
        return new DirectChannel();
    }

    // 3. Kết nối ống của Spring Boot với ống của Adafruit
    @Bean
    public MessageProducer inbound() {
        String uniqueClientId = clientId + "_inbound_" + UUID.randomUUID().toString();

        MqttPahoMessageDrivenChannelAdapter adapter =
                new MqttPahoMessageDrivenChannelAdapter(uniqueClientId, mqttClientFactory(), topicTelemetry);
        adapter.setCompletionTimeout(5000);
        adapter.setConverter(new DefaultPahoMessageConverter());
        adapter.setQos(1);
        adapter.setOutputChannel(mqttInputChannel());
        return adapter;
    }

    // 4. Hàm này sẽ TỰ ĐỘNG CHẠY mỗi khi có ai đó gửi data vào Feed
    @Bean
    @ServiceActivator(inputChannel = "mqttInputChannel")
    public MessageHandler handler() {
        return message -> {
            // Dùng hằng số của Spring Integration để lấy Topic chuẩn xác
            String topic = message.getHeaders().get(org.springframework.integration.mqtt.support.MqttHeaders.RECEIVED_TOPIC).toString();
            String payload = message.getPayload().toString();

            log.info("======================================");
            log.info("TIN NHẮN TỪ ADAFRUIT IO");
            log.info("Topic: {}", topic);
            log.info("Payload: {}", payload);
            log.info("======================================");

            // Truyền CẢ TOPIC VÀ PAYLOAD sang Service xử lý
            telemetryService.processAndSave(topic, payload);
        };
    }


    @Bean
    public MessageChannel mqttOutboundChannel() {
        return new DirectChannel();
    }

    // 2. Tạo thiết bị xả dữ liệu từ ống dẫn lên Adafruit
    @Bean
    @ServiceActivator(inputChannel = "mqttOutboundChannel")
    public MessageHandler mqttOutbound() {
        String uniqueClientId = clientId + "_outbound_" + UUID.randomUUID().toString();

        MqttPahoMessageHandler messageHandler =
                new MqttPahoMessageHandler(uniqueClientId, mqttClientFactory());

        messageHandler.setAsync(true);
        messageHandler.setDefaultTopic(topicControl);
        messageHandler.setDefaultQos(1);
        return messageHandler;
    }
}