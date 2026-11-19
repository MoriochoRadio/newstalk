package com.hkteam2.stocknews.user;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * 로그인 시도 제한 (무차별 대입 막기). 같은 아이디 + 같은 IP 에서 10분 안에 5번 틀리면 그때부터 1분 동안 막음.
 * - 1분이 지나면 풀림 (2026-11-16: 10분 → 1분, 사용자 "1분 뒤에 다시 풀리게"). 10분 안에 센 횟수는 그대로라 풀린 뒤 또 틀리면 바로 다시 잠김
 *   (11/19: 다시 잠길 때마다 2분·4분·8분… 으로 늘어남, 10분까지)
 *   (풀릴 때 횟수를 지우면 1분마다 5번씩 다시 시도할 수 있음)
 * - 막힌 동안은 비밀번호 검사(BCrypt)도 하지 않음 → 서버 부담도 줄임
 * - 성공하면 그 기록을 지움
 * - 아이디만 기준으로 하면 남이 일부러 틀려서 진짜 주인을 잠글 수 있어서 IP 도 같이 봄
 * - 메모리에 셈: 서버가 한 대라 충분. 서버를 여러 대로 늘리면 Redis 같은 공용 저장소가 필요 (한계)
 * - 한계: IP 를 계속 바꾸거나 여러 아이디에 흩어 시도하는 공격은 이것만으로 못 막음
 */
@Component
public class LoginAttemptLimiter {

    static final int MAX_FAILURES = 5;
    static final Duration WINDOW = Duration.ofMinutes(10);
    static final Duration LOCK = Duration.ofMinutes(1);
    private static final int CLEANUP_SIZE = 10_000; // 기록이 이만큼 쌓이면 오래된 것을 지움 (메모리가 끝없이 늘지 않게)
    private static final Duration CLEANUP_EVERY = Duration.ofMinutes(1);

    private final Clock clock;
    // 몇 번·몇 분 안에 틀리면 몇 분 막을지. 로그인(스프링 빈)은 위 기본값, 계정 찾기는 더 엄격한 값으로 따로 만들어 씀 (2026-11-19)
    private final int maxFailures;
    private final Duration window;
    private final Duration lock;
    /** 다시 잠길 때마다 잠금을 늘릴지. 모두가 함께 쓰는 제한(주소 무관)은 끔: 늘리면 남이 일부러 틀려 모두를 오래 막을 수 있음 */
    private final boolean backoff;
    private final ConcurrentHashMap<String, Attempts> attempts = new ConcurrentHashMap<>();
    /** 마지막으로 정리한 시각. 정리는 1분에 한 번만 (11/18: 끝난 기록이 없으면 요청마다 1만 건을 훑었음) */
    private volatile Instant lastCleanup = Instant.EPOCH;

    @Autowired
    public LoginAttemptLimiter() {
        this(Clock.systemUTC());
    }

    LoginAttemptLimiter(Clock clock) {
        this(MAX_FAILURES, WINDOW, LOCK, clock);
    }

    LoginAttemptLimiter(int maxFailures, Duration window, Duration lock, Clock clock) {
        this(maxFailures, window, lock, true, clock);
    }

    LoginAttemptLimiter(int maxFailures, Duration window, Duration lock, boolean backoff, Clock clock) {
        this.maxFailures = maxFailures;
        this.window = window;
        this.lock = lock;
        this.backoff = backoff;
        this.clock = clock;
    }

    /** 지금 막혀 있으면 true */
    public boolean isLocked(String loginId, String ip) {
        Attempts a = attempts.get(key(loginId, ip));
        return a != null && a.locked(clock.instant());
    }

    /**
     * 비밀번호를 검사해도 되면 true 를 주고 "검사 중" 하나를 셈. 끝나면 onFailure·onSuccess·release 중 하나를 꼭 부름.
     * 11/18: 예전엔 isLocked 확인 뒤 검사라, 같은 아이디로 동시에 50번 보내면 50번 모두 BCrypt 를 돌았음 →
     * 이미 틀린 수 + 검사 중인 수가 5번이면 더 받지 않음
     * 11/19: 5번을 채운 뒤에는 잠금(1분)이 풀리면 한 번에 하나씩만 받음. 예전엔 틀린 수가 5라서 잠금이 풀려도
     * 10분 창이 끝날 때까지 계속 막혔음 (화면은 "1분 뒤 다시"라고 안내 — QA 지적). 또 틀리면 onFailure 가 다시 잠금(점점 길게)
     */
    public boolean tryStart(String loginId, String ip) {
        Instant now = clock.instant();
        AtomicBoolean ok = new AtomicBoolean();
        attempts.compute(key(loginId, ip), (k, old) -> {
            Attempts a = current(old, now);
            boolean full = a.failures() < maxFailures ? a.failures() + a.inFlight() >= maxFailures : a.inFlight() > 0;
            if (a.locked(now) || full) {
                return a;
            }
            ok.set(true);
            return new Attempts(a.windowStart(), a.failures(), a.lockedUntil(), a.inFlight() + 1);
        });
        return ok.get();
    }

    /**
     * 틀렸을 때. 10분 안에 5번째부터는 틀릴 때마다 잠금. 잠금은 1분 → 2분 → 4분 … 으로 늘어남 (창 길이까지)
     * 11/19 보안 검토: 풀린 뒤 하나씩 받게 바꾸자 10분에 맞혀 볼 수 있는 수가 늘어남 → 계속 틀릴수록 오래 기다리게
     */
    public void onFailure(String loginId, String ip) {
        Instant now = clock.instant();
        attempts.compute(key(loginId, ip), (k, old) -> {
            Attempts a = current(old, now);
            int failures = a.failures() + 1;
            return new Attempts(a.windowStart(), failures, failures >= maxFailures ? now.plus(lockFor(failures)) : a.lockedUntil(),
                    Math.max(0, a.inFlight() - 1));
        });
        if (attempts.size() > CLEANUP_SIZE && now.isAfter(lastCleanup.plus(CLEANUP_EVERY))) {
            lastCleanup = now;
            attempts.entrySet().removeIf(e -> e.getValue().expired(now, window));
        }
    }

    /** 성공했을 때 기록을 지움 */
    public void onSuccess(String loginId, String ip) {
        attempts.remove(key(loginId, ip));
    }

    /** 맞다·틀리다를 못 정하고 끝났을 때(DB 오류 등) "검사 중"만 되돌림 */
    public void release(String loginId, String ip) {
        attempts.computeIfPresent(key(loginId, ip), (k, a) ->
                new Attempts(a.windowStart(), a.failures(), a.lockedUntil(), Math.max(0, a.inFlight() - 1)));
    }

    /** 창이 끝났어도 아직 잠겨 있으면 그대로 (늘어난 잠금이 창 끝에서 사라지지 않게) */
    private Attempts current(Attempts old, Instant now) {
        return old == null || (old.windowEnded(now, window) && !old.locked(now)) ? new Attempts(now, 0, null, 0) : old;
    }

    /** 5번째 1배, 6번째 2배, 7번째 4배 … 창 길이를 넘지 않음 */
    private Duration lockFor(int failures) {
        if (!backoff) {
            return lock;
        }
        Duration d = lock.multipliedBy(1L << Math.min(failures - maxFailures, 20));
        return d.compareTo(window) > 0 ? window : d;
    }

    private static String key(String loginId, String ip) {
        return (loginId == null ? "" : loginId.toLowerCase(Locale.ROOT)) + "|" + ip;
    }

    /** 바뀌지 않는 값: 셀 때마다 새로 만들어 compute 안에서 바꿔 끼움 (11/18: 예전엔 칸을 직접 고쳐 다른 스레드가 덜 고친 값을 읽을 수 있었음) */
    private record Attempts(Instant windowStart, int failures, Instant lockedUntil, int inFlight) {
        boolean locked(Instant now) {
            return lockedUntil != null && now.isBefore(lockedUntil);
        }

        boolean windowEnded(Instant now, Duration window) {
            return now.isAfter(windowStart.plus(window));
        }

        boolean expired(Instant now, Duration window) {
            Instant end = windowStart.plus(window);
            if (lockedUntil != null && lockedUntil.isAfter(end)) {
                end = lockedUntil;
            }
            return now.isAfter(end);
        }
    }
}
