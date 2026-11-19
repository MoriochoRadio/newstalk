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
import org.springframework.web.util.UrlPathHelper;

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
 * - 접속 주소는 getRemoteAddr (LoginAttemptLimiter 와 같은 기준). application.yml 의 forward-headers-strategy: native 로
 *   Tomcat 이 필터보다 먼저 nginx 가 덮어쓴 X-Forwarded-For 에서 실제 IP 를 꺼내 둠 → nginx 뒤에서도 사용자마다 셈
 *   (2026-11-19 로컬로 가져옴. 팀 main 은 이 설정이 없어 모두가 nginx 한 주소로 묶였음)
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
    /** 주소를 디코드·정리해서 봄 (스프링이 어느 API 로 보낼지 정할 때와 같은 모양) */
    private final UrlPathHelper paths = new UrlPathHelper();

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
        // 11/19 보안 검토: getRequestURI 는 디코드 전 원래 글자라 /%61pi/status 처럼 쓰면 '/api/' 로 시작하지 않아 세지 않았는데,
        // 스프링은 디코드해서 /api/status 로 보냄 → 제한을 그냥 지나갔음 (nginx 경유로 확인). 디코드·정리한 주소로 판단
        return perMinute <= 0 || !paths.getPathWithinApplication(request).startsWith("/api/");
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
