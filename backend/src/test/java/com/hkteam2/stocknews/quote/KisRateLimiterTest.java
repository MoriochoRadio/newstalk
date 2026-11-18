package com.hkteam2.stocknews.quote;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

/** KIS 줄 서기: 순번만 잠금 안에서 정하고, 줄이 10초보다 길면 기다리지 않고 429 (11/17 QA) */
class KisRateLimiterTest {

    @Test
    void 순번은_간격만큼_밀리고_줄이_너무_길면_바로_거절() {
        KisRateLimiter limiter = new KisRateLimiter(1000);   // 1초 간격
        long now = 0;
        assertThat(limiter.reserve(now)).isZero();
        assertThat(limiter.reserve(now)).isEqualTo(1_000_000_000L);
        for (int i = 2; i <= 10; i++) {
            assertThat(limiter.reserve(now)).isEqualTo(i * 1_000_000_000L);   // 10초까지는 기다림
        }
        assertThatThrownBy(() -> limiter.reserve(now))
                .isInstanceOf(KisApiException.class)
                .extracting("code").isEqualTo("EGW00201");                  // 11초는 거절 → 429 QUOTE_BUSY
        assertThat(limiter.reserve(20_000_000_000L)).isZero();               // 시간이 지나면 다시 바로
    }
}
