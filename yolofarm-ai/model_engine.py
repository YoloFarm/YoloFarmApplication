import pandas as pd
import numpy as np
import xgboost as xgb
import joblib
import os

MODEL_PATH = "xgboost_irrigation.pkl"

class IrrigationAI:
    def __init__(self):
        self.model = None
        self.feature_names = ['soil_moisture', 'avg_temp', 'forecast_temp', 'rain_prob']
        self.load_model()

    def load_model(self):
        if os.path.exists(MODEL_PATH):
            self.model = joblib.load(MODEL_PATH)
            print(">>> [MLOps] Đã nạp thành công mô hình XGBoost!")
        else:
            print(">>> [MLOps] Chưa có mô hình. Đang tự động Train...")
            self.train_new_model()

    def train_new_model(self):
        print(">>> [MLOps] Đang sinh Mock Data phức tạp...")
        np.random.seed(42)
        size = 2000
        
        # Sinh data có độ nhiễu cao để test độ lì của XGBoost
        sm = np.random.uniform(10, 90, size)
        temp = np.random.uniform(15, 42, size)
        ftemp = temp + np.random.uniform(-5, 5, size)
        rain = np.random.uniform(0, 100, size)
        
        # Đánh nhãn (Target) phức tạp hơn
        target = []
        for i in range(size):
            # Nếu sắp mưa to -> Nghỉ
            if rain[i] > 65: target.append(0)
            # Khô ran -> Tưới
            elif sm[i] < 35: target.append(1)
            # Ẩm ương nhưng sắp siêu nóng -> Tưới
            elif sm[i] < 55 and ftemp[i] > 36: target.append(1)
            else: target.append(0)

        df = pd.DataFrame({
            'soil_moisture': sm, 'avg_temp': temp, 
            'forecast_temp': ftemp, 'rain_prob': rain, 'target': target
        })

        X = df[self.feature_names]
        y = df['target']

        print(">>> [MLOps] Đang huấn luyện XGBoost Classifier...")
        # XGBoost có khả năng chống overfit và bắt pattern phi tuyến tính cực tốt
        self.model = xgb.XGBClassifier(
            n_estimators=150, 
            learning_rate=0.05, 
            max_depth=5, 
            random_state=42,
            eval_metric="logloss"
        )
        self.model.fit(X, y)
        
        accuracy = self.model.score(X, y)
        print(f">>> [MLOps] Huấn luyện xong! Độ chính xác: {accuracy*100:.2f}%")
        joblib.dump(self.model, MODEL_PATH)

    def predict(self, sm, temp, ftemp, rain):
        # 1. Dự đoán
        features = pd.DataFrame([[sm, temp, ftemp, rain]], columns=self.feature_names)
        pred = self.model.predict(features)[0]
        prob = self.model.predict_proba(features)[0][1] # Xác suất nhãn 1 (Tưới)

        # 2. XAI (Explainable AI): Lấy độ quan trọng của các yếu tố ảnh hưởng đến quyết định này
        importances = self.model.feature_importances_
        factors = {
            "Độ ẩm đất": float(round(importances[0] * 100, 1)),
            "Nhiệt độ hiện tại": float(round(importances[1] * 100, 1)),
            "Nhiệt độ dự báo": float(round(importances[2] * 100, 1)),
            "Xác suất mưa": float(round(importances[3] * 100, 1))
        }

        return bool(pred == 1), float(prob) * 100, factors