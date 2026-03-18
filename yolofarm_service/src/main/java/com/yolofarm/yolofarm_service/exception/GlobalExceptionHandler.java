package com.yolofarm.yolofarm_service.exception;

import com.yolofarm.yolofarm_service.dto.response.ApiResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

import java.nio.file.AccessDeniedException;

@ControllerAdvice
@Slf4j
public class GlobalExceptionHandler {
    @ExceptionHandler
    ResponseEntity handlingUncatagorizedException(Exception exception) {
        log.error("Exception:", exception);
        ErrorCode errorCode = ErrorCode.UNCATEGORIZED_EXCEPTION;

        ApiResponse apiResponse = ApiResponse.builder()
                .message(errorCode.getMessage())
                .build();

        return ResponseEntity.status(errorCode.getStatusCode()).body(apiResponse);

    }

    @ExceptionHandler(value = AppException.class)
    ResponseEntity<ApiResponse> handlingAppException(AppException exception) {
        ErrorCode errorCode = exception.getErrorCode();

        ApiResponse apiResponse = ApiResponse.builder()
                .message(exception.getMessage())
                .build();

        return ResponseEntity.status(errorCode.getStatusCode()).body(apiResponse);
    }
    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiResponse> handlingValidation(MethodArgumentNotValidException exception) {

        String message = exception.getFieldError().getDefaultMessage();

        return ResponseEntity.badRequest().body(
                ApiResponse.builder()
                        .message(message)
                        .build()
        );
    }

    @ExceptionHandler(value = AccessDeniedException.class)
    ResponseEntity<ApiResponse> handlingAccessDeniedException(AccessDeniedException exception) {
        ErrorCode errorCode = ErrorCode.UNAUTHORIZED;

        return ResponseEntity.status(errorCode.getStatusCode())
                .body(ApiResponse.builder()
                        .message(errorCode.getMessage())
                        .build());
    }

    @ExceptionHandler(value = HttpMessageNotReadableException.class)
    ResponseEntity<ApiResponse> handleHttpMessageNotReadableException
            (HttpMessageNotReadableException exception) {
        ErrorCode errorCode = ErrorCode.INVALID_ENUM_VALUE;

        return ResponseEntity.status(errorCode.getStatusCode())
                .body(ApiResponse.builder()
                        .message(errorCode.getMessage())
                        .build());
    }
}
