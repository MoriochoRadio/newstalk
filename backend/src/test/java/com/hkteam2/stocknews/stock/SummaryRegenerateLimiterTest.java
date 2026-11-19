package com.hkteam2.stocknews.stock;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import org.junit.jupiter.api.Test;

class SummaryRegenerateLimiterTest {

    private static final Instant T0 = Instant.parse("2026-11-17T00:00:00Z");

    @Test
    void 한_사람이_10분에_5번까지만_되고_다른_사람은_따로_센다() {
        SummaryRegenerateLimiter limiter = new SummaryRegenerateLimiter(Clock.fixed(T0, ZoneOffset.UTC));
        for (int i = 0; i < SummaryRegenerateLimiter.MAX_CALLS; i++) {
            assertThat(limiter.tryAcquire(1L)).isTrue();
        }
        assertThat(limiter.tryAcquire(1L)).isFalse();
        assertThat(limiter.tryAcquire(2L)).isTrue();
    }

    @Test
    void 새로_만들지_않은_호출은_돌려받아_횟수에_안_든다() {
        SummaryRegenerateLimiter limiter = new SummaryRegenerateLimiter(Clock.fixed(T0, ZoneOffset.UTC));
        // 저장본만 받은 호출 10번 (매번 돌려받음) → 그래도 5번 더 됨
        for (int i = 0; i < 10; i++) {
            assertThat(limiter.tryAcquire(1L)).isTrue();
            limiter.refund(1L);
        }
        for (int i = 0; i < SummaryRegenerateLimiter.MAX_CALLS; i++) {
            assertThat(limiter.tryAcquire(1L)).isTrue();
        }
        assertThat(limiter.tryAcquire(1L)).isFalse();
        limiter.refund(99L); // 기록 없는 사람을 돌려줘도 아무 일 없음
    }

    @Test
    void 창이_지나면_다시_된다() {
        MutableClock clock = new MutableClock(T0);
        SummaryRegenerateLimiter limiter = new SummaryRegenerateLimiter(clock);
        for (int i = 0; i <= SummaryRegenerateLimiter.MAX_CALLS; i++) {
            limiter.tryAcquire(1L);
        }
        assertThat(limiter.tryAcquire(1L)).isFalse();

        clock.now = T0.plus(SummaryRegenerateLimiter.WINDOW);
        assertThat(limiter.tryAcquire(1L)).isTrue();
    }

    private static final class MutableClock extends Clock {
        Instant now;

        MutableClock(Instant now) {
            this.now = now;
        }

        @Override
        public Instant instant() {
            return now;
        }

        @Override
        public java.time.ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return this;
        }
    }
}
