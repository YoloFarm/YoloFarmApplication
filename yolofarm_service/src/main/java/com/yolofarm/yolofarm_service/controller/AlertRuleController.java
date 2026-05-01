package com.yolofarm.yolofarm_service.controller;

import com.yolofarm.yolofarm_service.dto.request.AlertRuleRequest;
import com.yolofarm.yolofarm_service.dto.response.AlertRuleResponse;
import com.yolofarm.yolofarm_service.service.AlertRuleService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/alerts")
@RequiredArgsConstructor
public class AlertRuleController {

    private final AlertRuleService alertRuleService;

    @PostMapping("/rules")
    @PreAuthorize("hasAnyRole('USER', 'ADMIN')")
    public ResponseEntity<AlertRuleResponse> createRule(@RequestBody AlertRuleRequest request) {
        return ResponseEntity.ok(alertRuleService.createRule(request));
    }

    @GetMapping("/rules/{deviceId}")
    @PreAuthorize("hasAnyRole('USER', 'ADMIN')")
    public ResponseEntity<List<AlertRuleResponse>> getRules(@PathVariable String deviceId) {
        return ResponseEntity.ok(alertRuleService.getRulesByDevice(deviceId));
    }

    @DeleteMapping("/rules/{id}")
    @PreAuthorize("hasAnyRole('USER', 'ADMIN')")
    public ResponseEntity<String> deleteRule(@PathVariable Long id) {
        alertRuleService.deleteRule(id);
        return ResponseEntity.ok("Xóa luật thành công");
    }
}