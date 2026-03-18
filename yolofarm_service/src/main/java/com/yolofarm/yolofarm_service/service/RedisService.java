package com.yolofarm.yolofarm_service.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
public class RedisService {
    private final RedisTemplate<String, String > redisTemplate;

    public void setValue(String key, String value, Long duration, TimeUnit unit) {
        redisTemplate.opsForValue().set(key,value,duration,unit);
    }

    public String getValue(String key) {
        return redisTemplate.opsForValue().get(key);
    }

    public void deleteValue(String key) {
        redisTemplate.delete(key);
    }

    public Long getTtl(String key, TimeUnit unit) {
        return redisTemplate.getExpire(key, unit);
    }
}
