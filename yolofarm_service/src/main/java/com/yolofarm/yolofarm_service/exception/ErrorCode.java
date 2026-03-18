package com.yolofarm.yolofarm_service.exception;

import lombok.AccessLevel;
import lombok.Getter;
import lombok.experimental.FieldDefaults;
import org.springframework.http.HttpStatus;

@Getter
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public enum ErrorCode {
    UNCATEGORIZED_EXCEPTION("Uncategorize exception", HttpStatus.INTERNAL_SERVER_ERROR),
    UNAUTHENTICATED( "Unauthenticated", HttpStatus.UNAUTHORIZED),
    UNAUTHORIZED( "Unauthorized", HttpStatus.FORBIDDEN),
    INVALID_ENUM_VALUE( "Invalid enum value", HttpStatus.BAD_REQUEST),
    USERNAME_NOT_EXISTED( "Username not existed", HttpStatus.NOT_FOUND),
    USER_DISABLED( "User is disabled", HttpStatus.FORBIDDEN),
    USER_ID_NOT_EXISTED( "User id not existed", HttpStatus.NOT_FOUND),
    USERNAME_EXISTED( "Username existed", HttpStatus.BAD_REQUEST),
    DEVICE_ALREADY_EXISTS( "Device already exists", HttpStatus.BAD_REQUEST),
    INVALID_KEY( "Invalid key", HttpStatus.BAD_REQUEST),
    DEVICE_NOT_FOUND( "Device not found", HttpStatus.NOT_FOUND),
    NO_TELEMETRY_DATA( "No telemetry data", HttpStatus.NOT_FOUND)
    ;

    ErrorCode( String message, HttpStatus statusCode) {
        this.message = message;
        this.statusCode = statusCode;
    }
    public static class Key {
        public static final String DEVICE_CODE_REQUIRED = "DEVICE_CODE_REQUIRED";
        public static final String DEVICE_NAME_REQUIRED = "DEVICE_NAME_REQUIRED";
        public static final String  TECHNICAIN_ID_REQUIRED = "TECHNICIAN_ID_REQUIRED";
        public static final String NOTE_REQUIRED = "NOTE_REQUIRED";
    }

    final String message;
    final HttpStatus statusCode;
}