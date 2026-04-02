package com.yolofarm.yolofarm_service.dto.response;

import lombok.Data;

@Data
public class AiPredictionResponse {
    private boolean shouldWater;
    private int duration; // Phút
    private String reason; // Lý do AI đưa ra để hiển thị lên App
}