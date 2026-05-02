package com.yolofarm.yolofarm_service.service;

import com.yolofarm.yolofarm_service.dto.request.ScheduleRequest;
import com.yolofarm.yolofarm_service.dto.response.ScheduleResponse;
import com.yolofarm.yolofarm_service.entity.Device;
import com.yolofarm.yolofarm_service.entity.DeviceComponent;
import com.yolofarm.yolofarm_service.entity.DeviceSchedule;
import com.yolofarm.yolofarm_service.exception.AppException;
import com.yolofarm.yolofarm_service.exception.ErrorCode;
import com.yolofarm.yolofarm_service.repository.DeviceComponentRepository;
import com.yolofarm.yolofarm_service.repository.DeviceRepository;
import com.yolofarm.yolofarm_service.repository.DeviceScheduleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.support.CronExpression;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ScheduleService {

    private final DeviceScheduleRepository scheduleRepository;
    private final DeviceRepository deviceRepository;
    private final DeviceComponentRepository componentRepository;

    // ==========================================
    // HELPER: VALIDATE TOÀN DIỆN (QUYỀN + THIẾT BỊ + LINH KIỆN + CRON)
    // ==========================================
    private void validateScheduleLogic(String deviceId, String command, String cronExpression) {
        // 1. Check Thiết bị & Quyền sở hữu
        Device device = deviceRepository.findByDeviceIdAndActiveTrue(deviceId)
                .orElseThrow(() -> new AppException(ErrorCode.DEVICE_NOT_FOUND));

        String currentEmail = SecurityContextHolder.getContext().getAuthentication().getName();
        boolean isAdmin = SecurityContextHolder.getContext().getAuthentication().getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));

        if (!isAdmin && !currentEmail.equals(device.getOwnerEmail())) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }

        // 2. TÍNH NĂNG MỚI FIX: Check xem Linh Kiện (Command) có thuộc về Thiết bị này không?
        boolean componentExists = componentRepository.findByDevice_DeviceIdAndCodeNameAndActiveTrue(deviceId, command).isPresent();
        if (!componentExists) {
            throw new AppException(ErrorCode.DEVICE_COMPONENT_NOT_FOUND);
        }

        // 3. Check Cú pháp thời gian Cron
        if (!CronExpression.isValidExpression(cronExpression)) {
            throw new AppException(ErrorCode.INVALID_CRON_EXPRESSION);
        }
    }

    // ==========================================
    // CÁC HÀM XỬ LÝ CHÍNH
    // ==========================================
    public ScheduleResponse createSchedule(ScheduleRequest request) {
        // Validation sẽ gánh hết mọi rủi ro
        validateScheduleLogic(request.getDeviceId(), request.getCommand(), request.getCronExpression());

        DeviceSchedule schedule = DeviceSchedule.builder()
                .deviceId(request.getDeviceId())
                .command(request.getCommand())
                .action(request.getAction())
                .cronExpression(request.getCronExpression())
                .description(request.getDescription())
                .active(true)
                .build();

        return mapToResponse(scheduleRepository.save(schedule));
    }

    public List<ScheduleResponse> getSchedulesByDevice(String deviceId) {
        // Chỉ mượn tạm checkDeviceOwnership cho hàm GET
        Device device = deviceRepository.findByDeviceIdAndActiveTrue(deviceId)
                .orElseThrow(() -> new AppException(ErrorCode.DEVICE_NOT_FOUND));

        String currentEmail = SecurityContextHolder.getContext().getAuthentication().getName();
        boolean isAdmin = SecurityContextHolder.getContext().getAuthentication().getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));

        if (!isAdmin && !currentEmail.equals(device.getOwnerEmail())) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }

        return scheduleRepository.findAllByDeviceIdAndActiveTrue(deviceId)
                .stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public ScheduleResponse updateSchedule(Long id, ScheduleRequest request) {
        DeviceSchedule schedule = scheduleRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.SCHEDULE_NOT_FOUND));

        // Validate lại từ đầu với cục data mới
        validateScheduleLogic(request.getDeviceId(), request.getCommand(), request.getCronExpression());

        schedule.setDeviceId(request.getDeviceId());
        schedule.setCommand(request.getCommand());
        schedule.setAction(request.getAction());
        schedule.setCronExpression(request.getCronExpression());
        schedule.setDescription(request.getDescription());

        return mapToResponse(scheduleRepository.save(schedule));
    }

    public void deleteSchedule(Long id) {
        DeviceSchedule schedule = scheduleRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.SCHEDULE_NOT_FOUND));

        // Chỉ cần check quyền xem có được phép xóa không
        Device device = deviceRepository.findByDeviceIdAndActiveTrue(schedule.getDeviceId()).get();
        String currentEmail = SecurityContextHolder.getContext().getAuthentication().getName();
        boolean isAdmin = SecurityContextHolder.getContext().getAuthentication().getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));

        if (!isAdmin && !currentEmail.equals(device.getOwnerEmail())) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }

        schedule.setActive(false);
        scheduleRepository.save(schedule);
    }

    private ScheduleResponse mapToResponse(DeviceSchedule s) {
        return ScheduleResponse.builder()
                .id(s.getId()).deviceId(s.getDeviceId()).command(s.getCommand())
                .action(s.getAction()).cronExpression(s.getCronExpression())
                .description(s.getDescription()).active(s.isActive()).createdAt(s.getCreatedAt())
                .build();
    }
}