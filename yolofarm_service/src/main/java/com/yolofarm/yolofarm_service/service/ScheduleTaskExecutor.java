package com.yolofarm.yolofarm_service.service;

import com.yolofarm.yolofarm_service.dto.request.ControlRequest;
import com.yolofarm.yolofarm_service.entity.DeviceSchedule;
import com.yolofarm.yolofarm_service.repository.DeviceScheduleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.scheduling.support.CronExpression;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@Slf4j
@RequiredArgsConstructor
public class ScheduleTaskExecutor {

    private final DeviceScheduleRepository scheduleRepository;
    private final DeviceControlService deviceControlService;

    // Quét mỗi phút một lần
    @Scheduled(cron = "0 * * * * *")
    public void executeSchedules() {
        List<DeviceSchedule> activeSchedules = scheduleRepository.findAllByActiveTrue();
        if (activeSchedules.isEmpty()) return;

        LocalDateTime now = LocalDateTime.now().withSecond(0).withNano(0);

        for (DeviceSchedule schedule : activeSchedules) {
            try {
                // An toàn: Bỏ qua nếu expression bị null/rỗng
                if (schedule.getCronExpression() == null || schedule.getCronExpression().trim().isEmpty()) {
                    continue;
                }

                CronExpression cron = CronExpression.parse(schedule.getCronExpression());

                if (cron.next(now.minusSeconds(1)).equals(now)) {
                    log.info(">>> KÍCH HOẠT SCHEDULE [{}]: Thiết bị: {}, Linh kiện: {} -> {}",
                            schedule.getId(), schedule.getDeviceId(), schedule.getCommand(), schedule.getAction());

                    ControlRequest controlRequest = ControlRequest.builder()
                            .deviceId(schedule.getDeviceId())
                            .command(schedule.getCommand()) // Đã được Service Validate chắc chắn tồn tại!
                            .action(schedule.getAction())
                            .build();

                    deviceControlService.sendControlCommand(controlRequest);
                }
            } catch (Exception e) {
                log.error(">>> LỖI THỰC THI SCHEDULE ID {}: {}", schedule.getId(), e.getMessage());
            }
        }
    }
}