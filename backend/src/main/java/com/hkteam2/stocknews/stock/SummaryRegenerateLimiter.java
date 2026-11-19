package com.hkteam2.stocknews.stock;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * 요약 다시 생성 횟수 제한 (회원 한 명 기준). 10분 안에 5번까지.
 * AI 서버의 10분 대기는 종목마다 따로라서, 한 사람이 종목을 돌아가며 부르면 LLM 비용이 계속 나감 → 사람 기준으로도 막음.
 * - 메모리에 셈: 서버가 한 대라 충분. 여러 대면 Redis 같은 공용 저장소가 필요 (LoginAttemptLimiter 와 같은 한계)
 */
@Component
public class SummaryRegenerateLimiter {

    static final int MAX_CALLS = 5;
    static final Duration WINDOW = Duration.ofMinutes(10);
    private static final int CLEANUP_SIZE = 10_000; // 기록이 이만큼 쌓이면 끝난 것을 지움
    private static final Duration CLEANUP_EVERY = Duration.ofMinutes(1);

    private final Clock clock;
    private final ConcurrentHashMap<Long, Window> windows = new ConcurrentHashMap<>();
    /** 마지막으로 정리한 시각. 정리는 1분에 한 번만 (11/18: 끝난 기록이 없으면 요청마다 1만 건을 훑었음) */
    private volatile Instant lastCleanup = Instant.EPOCH;

    @Autowired
    public SummaryRegenerateLimiter() {
        this(Clock.systemUTC());
    }

    SummaryRegenerateLimiter(Clock clock) {
        this.clock = clock;
    }

    /** 이번 호출을 세고, 한도 안이면 true. 세는 일은 compute 안에서 새 값으로 바꿔 끼움 (11/18: 예전엔 객체 칸을 직접 늘려 경합) */
    public boolean tryAcquire(Long userId) {
        Instant now = clock.instant();
        Window w = windows.compute(userId, (k, old) ->
                old == null || old.ended(now) ? new Window(now, 1) : new Window(old.start(), old.calls() + 1));
        if (windows.size() > CLEANUP_SIZE && now.isAfter(lastCleanup.plus(CLEANUP_EVERY))) {
            lastCleanup = now;
            windows.values().removeIf(old -> old.ended(now));
        }
        return w.calls() <= MAX_CALLS;
    }

    /**
     * 비용이 안 든 호출은 돌려줌 (11/19 PR #131 검토): AI 서버가 '10분 안에 이미 만듦'으로 저장본만 주거나 오류가 나면
     * LLM 을 부르지 않았는데도 횟수만 줄어 같은 종목 버튼 몇 번에 429 가 났음
     */
    public void refund(Long userId) {
        windows.computeIfPresent(userId, (k, old) -> old.calls() <= 1 ? null : new Window(old.start(), old.calls() - 1));
    }

    private record Window(Instant start, int calls) {
        boolean ended(Instant now) {
            return !now.isBefore(start.plus(WINDOW));
        }
    }
}
