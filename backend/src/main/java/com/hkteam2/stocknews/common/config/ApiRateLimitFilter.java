package com.hkteam2.stocknews.common.config;

import java.io.IOException;
import java.time.Clock;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.hkteam2.stocknews.common.error.ErrorCode;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * API 호출 수 제한 (2026-11-18, '새로 불러오기' 버튼을 만들며 "여러 번 누르기·공격에 방어되나?" 확인).
 * 그전엔 로그인(10분 5번)·AI 요약 다시 만들기(같은 종목 10분 1번)·KIS(초당 간격 + 캐시)만 막혀 있고,
 * 읽기 API 는 같은 곳에서 끝없이 부를 수 있었음 → 접속 주소(IP)마다 1분에 perMinute 번까지, 넘으면 429 TOO_MANY_REQUESTS
 *
 * - 1분 칸(고정 창) 방식: 칸이 바뀌면 0부터. 단순하고 메모리가 적음. 칸 경계에서 잠깐 2배까지 들어올 수 있는 한계는 받아들임
 * - 기준: 홈 첫 화면 약 16번, 종목 화면(작은 차트 포함) 수십 번. 새로 불러오기는 10초에 한 번 → 보통 사용은 600 에 닿지 않음
 * - 접속 주소는 getRemoteAddr 그대로 (X-Forwarded-For 는 누구나 꾸밀 수 있어 믿지 않음 — LoginAttemptLimiter 와 같은 기준).
 *   한계: 앞에 프록시(nginx 등)를 두면 모두 같은 주소로 보여 한 묶음으로 셈
 * - 보안 필터보다 먼저 돌아서 넘친 요청은 DB·토큰 검사까지 가지 않음. 0 이면 끔 (테스트)
 * - 메모리에 셈: 서버가 한 대라 충분. 여러 대면 Redis 같은 공용 저장소가 필요
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class ApiRateLimitFilter extends OncePerRequestFilter {

    private static final long WINDOW_MS = 60_000;
    private static final int CLEANUP_SIZE = 10_000;

    private final int perMinute;
    private final Clock clock;
    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();

    @Autowired
    public ApiRateLimitFilter(@Value("${app.rate-limit.per-minute:600}") int perMinute) {
        this(perMinute, Clock.systemUTC());
    }

    ApiRateLimitFilter(int perMinute, Clock clock) {
        this.perMinute = perMinute;
        this.clock = clock;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return perMinute <= 0 || !request.getRequestURI().startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        long now = clock.millis();
        long start = now - now % WINDOW_MS;
        Window w = windows.compute(request.getRemoteAddr(),
                (ip, old) -> old == null || old.start != start ? new Window(start) : old);
        int count;
        synchronized (w) {
            count = ++w.count;
        }
        if (windows.size() > CLEANUP_SIZE) {
            windows.values().removeIf(x -> x.start < start);
        }
        if (count > perMinute) {
            ErrorCode code = ErrorCode.TOO_MANY_REQUESTS;
            response.setStatus(code.getStatus().value());
            response.setHeader("Retry-After", String.valueOf(Math.max(1, (start + WINDOW_MS - now + 999) / 1000)));
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setCharacterEncoding("UTF-8");
            response.getWriter().write("{\"code\":\"" + code.name() + "\",\"message\":\"" + code.getMessage() + "\"}");
            return;
        }
        chain.doFilter(request, response);
    }

    private static final class Window {
        final long start;
        int count;

        Window(long start) {
            this.start = start;
        }
    }
}
