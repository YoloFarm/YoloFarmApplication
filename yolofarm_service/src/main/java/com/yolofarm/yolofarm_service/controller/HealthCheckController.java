package com.yolofarm.yolofarm_service.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;

@Controller
@RequestMapping("/api/health")
public class HealthCheckController {
    @GetMapping()
    public String health() {
        return "ok";
    }
}
