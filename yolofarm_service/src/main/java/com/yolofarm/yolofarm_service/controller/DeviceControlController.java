package com.yolofarm.yolofarm_service.controller;


import com.yolofarm.yolofarm_service.dto.request.ControlRequest;
import com.yolofarm.yolofarm_service.dto.response.ApiResponse;
import com.yolofarm.yolofarm_service.dto.response.ControlResponse;
import com.yolofarm.yolofarm_service.service.DeviceControlService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/control")
@RequiredArgsConstructor
public class DeviceControlController {
    private final DeviceControlService service;

    @PostMapping
    public ApiResponse<ControlResponse> controlDevice(@Valid @RequestBody ControlRequest request) {
        return ApiResponse.<ControlResponse>builder()
                .result(service.sendControlCommand(request))
                .build();
    }
}
