package com.hkteam2.stocknews.user;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

import org.junit.jupiter.api.Test;

/** 로그인 시도 제한: 시계를 직접 움직여 10분 안 5번·1분 잠금 규칙을 확인 */
class LoginAttemptLimiterTest {

    /** 테스트에서 시간을 앞으로 돌릴 수 있는 시계 */
    static final class MovableClock extends Clock {
        Instant now = Instant.parse("2026-11-13T01:00:00Z");

        void plus(Duration d) {
            now = now.plus(d);
        }

        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    }

    private final MovableClock clock = new MovableClock();
    private final LoginAttemptLimiter limiter = new LoginAttemptLimiter(clock);

    private void fail(int times, String id, String ip) {
        for (int i = 0; i < times; i++) {
            limiter.onFailure(id, ip);
        }
    }

    @Test
    void 네_번까지는_안_막히고_다섯_번째에_막힌다() {
        fail(4, "user1", "1.1.1.1");
        assertThat(limiter.isLocked("user1", "1.1.1.1")).isFalse();
        fail(1, "user1", "1.1.1.1");
        assertThat(limiter.isLocked("user1", "1.1.1.1")).isTrue();
    }

    @Test
    void 일분이_지나면_풀린다() {
        fail(5, "user1", "1.1.1.1");
        clock.plus(Duration.ofSeconds(59));
        assertThat(limiter.isLocked("user1", "1.1.1.1")).isTrue();
        clock.plus(Duration.ofSeconds(2));
        assertThat(limiter.isLocked("user1", "1.1.1.1")).isFalse();
    }

    @Test
    void 풀린_뒤_또_틀리면_바로_다시_잠긴다() {
        fail(5, "user1", "1.1.1.1");
        clock.plus(Duration.ofMinutes(1));
        assertThat(limiter.isLocked("user1", "1.1.1.1")).isFalse();
        fail(1, "user1", "1.1.1.1"); // 1분마다 5번씩 다시 시도하지 못하게
        assertThat(limiter.isLocked("user1", "1.1.1.1")).isTrue();
    }

    @Test
    void 잠금이_풀리면_로그인_검사도_다시_받는다() {
        // 11/19 QA: isLocked 는 풀렸는데 tryStart 는 틀린 수 5 때문에 10분 창 끝까지 막았음
        fail(5, "user1", "1.1.1.1");
        assertThat(limiter.tryStart("user1", "1.1.1.1")).isFalse();
        clock.plus(Duration.ofMinutes(1).plusSeconds(1));
        assertThat(limiter.tryStart("user1", "1.1.1.1")).as("풀린 뒤 한 번").isTrue();
        assertThat(limiter.tryStart("user1", "1.1.1.1")).as("검사 중엔 하나만").isFalse();
        limiter.onFailure("user1", "1.1.1.1");
        assertThat(limiter.tryStart("user1", "1.1.1.1")).as("또 틀리면 다시 1분").isFalse();
    }

    @Test
    void 계속_틀리면_잠금이_1분_2분_4분으로_늘어난다() {
        // 11/19 보안 검토: 풀린 뒤 1분마다 하나씩 받으면 10분에 맞혀 볼 수가 늘어남
        fail(5, "user1", "1.1.1.1");
        clock.plus(Duration.ofMinutes(1).plusSeconds(1));
        fail(1, "user1", "1.1.1.1");
        clock.plus(Duration.ofSeconds(110));
        assertThat(limiter.isLocked("user1", "1.1.1.1")).as("두 번째 잠금은 2분").isTrue();
        clock.plus(Duration.ofSeconds(11));
        assertThat(limiter.isLocked("user1", "1.1.1.1")).isFalse();
        fail(1, "user1", "1.1.1.1");
        clock.plus(Duration.ofMinutes(3).plusSeconds(50));
        assertThat(limiter.isLocked("user1", "1.1.1.1")).as("세 번째 잠금은 4분").isTrue();
    }

    @Test
    void 늘리기를_끈_제한은_잠금이_늘지_않는다() {
        // 모두가 함께 쓰는 아이디 찾기 제한 (11/19 보안 검토: 늘리면 남이 모두를 하루씩 막을 수 있음)
        LoginAttemptLimiter shared = new LoginAttemptLimiter(2, Duration.ofDays(1), Duration.ofHours(1), false, clock);
        shared.onFailure("find-id", "*");
        shared.onFailure("find-id", "*");
        clock.plus(Duration.ofHours(1).plusSeconds(1));
        shared.onFailure("find-id", "*");
        clock.plus(Duration.ofHours(1).plusSeconds(1));
        assertThat(shared.isLocked("find-id", "*")).as("세 번째도 1시간").isFalse();
    }

    @Test
    void 잠금이_창_끝을_넘어가도_창이_끝났다고_풀리지_않는다() {
        LoginAttemptLimiter strict = new LoginAttemptLimiter(1, Duration.ofMinutes(10), Duration.ofMinutes(10), clock);
        clock.plus(Duration.ofMinutes(9));
        strict.onFailure("user1", "1.1.1.1"); // 창 9분째에 10분 잠금 → 19분까지
        clock.plus(Duration.ofMinutes(5));
        assertThat(strict.tryStart("user1", "1.1.1.1")).isFalse();
    }

    @Test
    void 틀린_횟수는_십분이_지나면_처음부터_센다() {
        fail(4, "user1", "1.1.1.1");
        clock.plus(Duration.ofMinutes(11));
        fail(1, "user1", "1.1.1.1");
        assertThat(limiter.isLocked("user1", "1.1.1.1")).isFalse();
    }

    @Test
    void 성공하면_센_것을_지운다() {
        fail(4, "user1", "1.1.1.1");
        limiter.onSuccess("user1", "1.1.1.1");
        fail(4, "user1", "1.1.1.1");
        assertThat(limiter.isLocked("user1", "1.1.1.1")).isFalse();
    }

    @Test
    void 다른_곳에서는_주인이_계속_로그인할_수_있다() {
        // 남이 일부러 틀려서 진짜 주인을 잠그지 못하게 IP 도 같이 봄
        fail(5, "user1", "6.6.6.6");
        assertThat(limiter.isLocked("user1", "6.6.6.6")).isTrue();
        assertThat(limiter.isLocked("user1", "1.1.1.1")).isFalse();
    }

    @Test
    void 아이디_대소문자는_같은_아이디로_센다() {
        fail(3, "User1", "1.1.1.1");
        fail(2, "user1", "1.1.1.1");
        assertThat(limiter.isLocked("USER1", "1.1.1.1")).isTrue();
    }

    @Test
    void 동시에_들어온_시도는_틀린_수와_합쳐_다섯_번까지만_검사한다() {
        // 11/18: 확인 뒤 검사라 동시 요청은 모두 BCrypt 를 돌았음
        fail(2, "user1", "1.1.1.1");
        int started = 0;
        for (int i = 0; i < 10; i++) {
            if (limiter.tryStart("user1", "1.1.1.1")) {
                started++;
            }
        }
        assertThat(started).isEqualTo(3);
        limiter.release("user1", "1.1.1.1");
        assertThat(limiter.tryStart("user1", "1.1.1.1")).as("하나 끝나면 다시 하나").isTrue();
    }
}
