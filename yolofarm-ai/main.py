from fastapi import FastAPI, BackgroundTasks
from pydantic import BaseModel
from typing import List, Dict
from model_engine import IrrigationAI

app = FastAPI(title="YoloFarm AI Microservice", version="2.0.0")

# Khởi tạo AI Engine
ai_engine = IrrigationAI()

# --- DTOs ---
class SensorData(BaseModel):
    type: str
    value: float
    time: str

class WeatherData(BaseModel):
    forecastTemp: float
    rainProbability: float

class PredictionRequest(BaseModel):
    deviceId: str
    data: List[SensorData]
    externalWeather: WeatherData

# --- ENDPOINTS ---

@app.post("/predict")
async def get_prediction(req: PredictionRequest):
    # Trích xuất data
    sm_list = [d.value for d in req.data if d.type == "SOIL_MOISTURE"]
    temp_list = [d.value for d in req.data if d.type == "TEMP"]
    
    sm = sum(sm_list) / len(sm_list) if sm_list else 50.0
    temp = sum(temp_list) / len(temp_list) if temp_list else 25.0
    ftemp = req.externalWeather.forecastTemp
    rain = req.externalWeather.rainProbability

    # Gọi XGBoost suy luận
    should_water, confidence, factors = ai_engine.predict(sm, temp, ftemp, rain)
    
    # Logic nghiệp vụ sau ML
    duration = 0
    reason = "Hệ thống AI XGBoost đánh giá an toàn, không cần can thiệp."
    if should_water:
        duration = 15 if ftemp < 36 else 25
        reason = f"XGBoost phát hiện rủi ro khô hạn. Xác suất cần tưới: {confidence:.1f}%"

    return {
        "shouldWater": should_water,
        "confidence": round(confidence, 2),
        "duration": duration,
        "reason": reason,
        "explainable_factors": factors # Tính năng "ăn tiền" XAI
    }

@app.post("/retrain")
async def trigger_retrain(background_tasks: BackgroundTasks):
    """
    API này để Spring Boot gọi sang khi muốn AI học lại từ đầu (VD: Cuối mỗi tháng)
    Chạy background để không làm treo request.
    """
    background_tasks.add_task(ai_engine.train_new_model)
    return {"message": "Đã đưa tiến trình Retrain XGBoost vào chạy ngầm."}

# Chạy server bằng uv: uv run uvicorn main:app --port 5000 --reload