package com.hkteam2.stocknews.common;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicLong;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import com.hkteam2.stocknews.common.config.ApiRateLimitFilterAccess;

/** API 호출 수 제한: 같은 IP 1분에 N번, 넘으면 429 + Retry-After, 다음 1분이면 다시, IP 가 다르면 따로 셈 */
class ApiRateLimitFilterTest {

    private final AtomicLong now = new AtomicLong(Instant.parse("2026-11-18T07:00:00Z").toEpochMilli());
    private final Clock clock = new Clock() {
        @Override
        public ZoneOffset getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return Instant.ofEpochMilli(now.get());
        }
    };

    private int call(jakarta.servlet.Filter filter, String ip, String path) throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", path);
        req.setRemoteAddr(ip);
        MockHttpServletResponse res = new MockHttpServletResponse();
        filter.doFilter(req, res, new MockFilterChain());
        return res.getStatus();
    }

    @Test
    void 한도를_넘으면_429_다음_1분이면_다시_된다() throws Exception {
        var filter = ApiRateLimitFilterAccess.create(3, clock);
        for (int i = 0; i < 3; i++) {
            assertThat(call(filter, "1.1.1.1", "/api/articles")).isEqualTo(200);
        }
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/articles");
        req.setRemoteAddr("1.1.1.1");
        MockHttpServletResponse res = new MockHttpServletResponse();
        filter.doFilter(req, res, new MockFilterChain());
        assertThat(res.getStatus()).isEqualTo(429);
        assertThat(res.getContentAsString()).contains("TOO_MANY_REQUESTS");
        assertThat(res.getHeader("Retry-After")).isEqualTo("60");

        assertThat(call(filter, "2.2.2.2", "/api/articles")).isEqualTo(200);   // 다른 IP 는 따로

        now.addAndGet(60_000);
        assertThat(call(filter, "1.1.1.1", "/api/articles")).isEqualTo(200);
    }

    @Test
    void 주소_글자를_인코딩해도_같은_API_로_센다() throws Exception {
        // 11/19 보안 검토: /%61pi/... 는 디코드하면 /api/... 인데 세지 않아 제한을 지나갔음
        var filter = ApiRateLimitFilterAccess.create(2, clock);
        assertThat(call(filter, "1.1.1.1", "/api/articles")).isEqualTo(200);
        assertThat(call(filter, "1.1.1.1", "/%61pi/articles")).isEqualTo(200);
        assertThat(call(filter, "1.1.1.1", "/%61pi/articles")).isEqualTo(429);
        assertThat(call(filter, "1.1.1.1", "/api;x=1/articles")).isEqualTo(429);
    }

    @Test
    void api_가_아닌_주소와_0_은_세지_않는다() throws Exception {
        var filter = ApiRateLimitFilterAccess.create(1, clock);
        for (int i = 0; i < 5; i++) {
            assertThat(call(filter, "1.1.1.1", "/swagger-ui/index.html")).isEqualTo(200);
        }
        var off = ApiRateLimitFilterAccess.create(0, clock);
        for (int i = 0; i < 5; i++) {
            assertThat(call(off, "1.1.1.1", "/api/articles")).isEqualTo(200);
        }
    }
}
