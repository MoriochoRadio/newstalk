package com.hkteam2.stocknews.common.config;

import java.time.Clock;

/** 테스트에서 시계를 바꿔 끼운 필터를 만들려고 (생성자가 패키지 안에서만 보임) */
public final class ApiRateLimitFilterAccess {

    private ApiRateLimitFilterAccess() {
    }

    public static ApiRateLimitFilter create(int perMinute, Clock clock) {
        return new ApiRateLimitFilter(perMinute, clock);
    }
}
