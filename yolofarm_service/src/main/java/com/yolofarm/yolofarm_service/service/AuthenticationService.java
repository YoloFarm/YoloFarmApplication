package com.yolofarm.yolofarm_service.service;

import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jose.crypto.MACVerifier;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import com.yolofarm.yolofarm_service.dto.request.IntrospectRequest;
import com.yolofarm.yolofarm_service.dto.request.LoginRequest;
import com.yolofarm.yolofarm_service.dto.request.LogoutRequest;
import com.yolofarm.yolofarm_service.dto.request.RefreshTokenRequest;
import com.yolofarm.yolofarm_service.dto.response.AuthenticationResponse;
import com.yolofarm.yolofarm_service.dto.response.IntrospectResponse;
import com.yolofarm.yolofarm_service.entity.User;
import com.yolofarm.yolofarm_service.exception.AppException;
import com.yolofarm.yolofarm_service.exception.ErrorCode;
import com.yolofarm.yolofarm_service.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;

import java.text.ParseException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.StringJoiner;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Service
@Slf4j
@RequiredArgsConstructor
public class AuthenticationService {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final RedisService redisService;

    @Value("${jwt.signerKey}")
    protected String SECRET_KEY;

    @Value("${jwt.valid-duration}")
    protected long VALID_DURATION;

    @Value("${jwt.refreshable-duration}")
    protected long REFRESHABLE_DURATION;


    public IntrospectResponse introspect(IntrospectRequest request) {
        var token = request.getToken();
        boolean isValid = true;
        try {
            verifyToken(token, false);
        } catch (Exception e) {
            isValid = false;
        }
        return IntrospectResponse.builder()
                .valid(isValid)
                .build();

    }

    public AuthenticationResponse login(LoginRequest request) {

        User user = userRepository.findByUsername(request.getUsername())
                .orElseThrow(() -> new AppException(ErrorCode.USERNAME_NOT_EXISTED));

        if (!user.isActive()) {
            throw new AppException(ErrorCode.USER_DISABLED);
        }

        boolean isAuthenticated = passwordEncoder.matches(request.getPassword(), user.getPasswordHash());

        if(!isAuthenticated)
            throw new AppException(ErrorCode.UNAUTHENTICATED);

        String token = generateToken(user);

        return AuthenticationResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .role(user.getRole())
                .token(token)
                .authenticated(isAuthenticated)
                .build();
    }

    public void logout(LogoutRequest request) throws ParseException, JOSEException {
        try {
            var signedToken = verifyToken(request.getToken(), true);

            var jti = signedToken.getJWTClaimsSet().getJWTID();
            Date expiryTime = signedToken.getJWTClaimsSet().getExpirationTime();

            long ttl = (expiryTime.getTime() - System.currentTimeMillis()) / 1000;

            if (ttl > 0) {
                redisService.setValue(jti, request.getToken(), ttl, TimeUnit.SECONDS);
            }

        } catch (Exception e) {
            log.info("Invalid Token during logout: {}", e.getMessage());
        }
    }


    public AuthenticationResponse refreshToken(RefreshTokenRequest request) throws ParseException, JOSEException {
        var signedToken = verifyToken(request.getToken(), true);

        var jti = signedToken.getJWTClaimsSet().getJWTID();
        Date expiryTime = signedToken.getJWTClaimsSet().getExpirationTime();


        long ttl = (expiryTime.getTime() - System.currentTimeMillis()) / 1000;

        if (ttl > 0) {
            redisService.setValue(jti, request.getToken(), ttl, TimeUnit.SECONDS);
        }

        String username = signedToken.getJWTClaimsSet().getSubject();
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new AppException(ErrorCode.UNAUTHENTICATED));

        if (!user.isActive()) {
            throw new AppException(ErrorCode.USER_DISABLED);
        }

        String newToken = generateToken(user);
        return AuthenticationResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .role(user.getRole())
                .token(newToken)
                .authenticated(true)
                .build();
    }


    private SignedJWT verifyToken(String token, boolean isRefresh)
            throws ParseException, JOSEException {
        JWSVerifier verifier = new MACVerifier(SECRET_KEY.getBytes());

        SignedJWT signedJWT = SignedJWT.parse(token);

        Date expiryTime = isRefresh
                ? new Date(signedJWT
                .getJWTClaimsSet().getIssueTime()
                .toInstant().plus(REFRESHABLE_DURATION, ChronoUnit.SECONDS).toEpochMilli())
                :signedJWT.getJWTClaimsSet().getExpirationTime();

        boolean isValid = signedJWT.verify(verifier);

        if(!(isValid && expiryTime.after(new Date())))
            throw new AppException(ErrorCode.UNAUTHENTICATED);
        if(redisService.getValue(signedJWT.getJWTClaimsSet().getJWTID()) != null)
            throw new AppException(ErrorCode.UNAUTHENTICATED);

        return signedJWT;
    }

    public String generateToken(User user)  {
        JWSHeader jwsHeader = new JWSHeader(JWSAlgorithm.HS512);
        JWTClaimsSet claimsSet = new JWTClaimsSet.Builder()
                .subject(user.getUsername())
                .issueTime(new Date())
                .expirationTime(new Date(
                        Instant.now().plus(VALID_DURATION, ChronoUnit.SECONDS).toEpochMilli()
                ))
                .jwtID(UUID.randomUUID().toString())
                .claim("scope", buildScope(user))
                .claim("userId", user.getId())
                .build();

        Payload payload = new Payload(claimsSet.toJSONObject());
        JWSObject jwsObject = new JWSObject(jwsHeader,payload);


        try {
            jwsObject.sign(new MACSigner(SECRET_KEY.getBytes()));
        } catch (JOSEException e) {
            throw new RuntimeException(e);
        }
        return jwsObject.serialize();
    }

    private String buildScope(User user) {
        return "ROLE_" + user.getRole().name();
    }
}
