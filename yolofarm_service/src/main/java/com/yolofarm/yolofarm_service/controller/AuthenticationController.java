package com.yolofarm.yolofarm_service.controller;

import com.yolofarm.yolofarm_service.dto.request.IntrospectRequest;
import com.yolofarm.yolofarm_service.dto.request.LoginRequest;
import com.yolofarm.yolofarm_service.dto.request.LogoutRequest;
import com.yolofarm.yolofarm_service.dto.request.RefreshTokenRequest;
import com.yolofarm.yolofarm_service.dto.response.ApiResponse;
import com.yolofarm.yolofarm_service.dto.response.AuthenticationResponse;
import com.yolofarm.yolofarm_service.dto.response.IntrospectResponse;
import com.yolofarm.yolofarm_service.service.AuthenticationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthenticationController {

    private final AuthenticationService authenticationService;

    @PostMapping("/login")
    public ApiResponse<AuthenticationResponse> login(@RequestBody LoginRequest request) {
        return ApiResponse.<AuthenticationResponse>builder()
                .result(authenticationService.login(request))
                .build();
    }

    @PostMapping("/logout")
    public ApiResponse<String> logout(@RequestBody LogoutRequest request) throws Exception {
        authenticationService.logout(request);
        return ApiResponse.<String>builder()
                .result("Logout successfully")
                .build();
    }

    @PostMapping("/refresh")
    public ApiResponse<AuthenticationResponse> refresh(@RequestBody RefreshTokenRequest request) throws Exception {
        return ApiResponse.<AuthenticationResponse>builder()
                .result(authenticationService.refreshToken(request))
                .build();
    }

    @PostMapping("/introspect")
    public ApiResponse<IntrospectResponse> introspect(@RequestBody IntrospectRequest request)  {
        return ApiResponse.<IntrospectResponse>builder()
                .result(authenticationService.introspect(request))
                .build();
    }


}