# ==========================================
# STAGE 1: BUILD (Dùng Maven để đóng gói code)
# ==========================================
FROM maven:3.9.6-eclipse-temurin-21-alpine AS builder
WORKDIR /app

# Copy file cấu hình Maven vào trước để tải dependency (Tận dụng Docker Cache)
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Copy toàn bộ source code vào và Build ra file .jar (Bỏ qua chạy Test cho nhanh)
COPY src ./src
RUN mvn clean package -DskipTests

# ==========================================
# STAGE 2: RUNTIME (Môi trường chạy siêu nhẹ)
# ==========================================
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Chỉ copy đúng cái file .jar từ Stage 1 sang Stage 2
COPY --from=builder /app/target/*.jar app.jar

# Khai báo port Spring Boot đang chạy
EXPOSE 8080

# Chạy ứng dụng
ENTRYPOINT ["java", "-jar", "app.jar"]