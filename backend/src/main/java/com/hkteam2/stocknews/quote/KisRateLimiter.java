package com.hkteam2.stocknews.quote;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * KIS REST 호출 줄 세우기: 서버 전체에서 KIS로 가는 요청 사이를 최소 간격만큼 띄움
 *
 * 왜: 사용자가 몇 명이든 KIS 입장에서는 내 앱키 하나가 부르는 것. 2026-11-03 시험에서 조회 3~4번을
 * 연달아 보내자 EGW00201(초당 거래건수 초과)이 남 → 간격을 두고 보냄
 * 기본 500ms(초당 2건). KIS가 정한 정확한 한도는 포털 공지로 확인 후 KIS_REST_MIN_INTERVAL_MS 로 조정
 *
 * 줄 서기: 앞 사람이 나간 뒤 간격이 지나야 다음 사람이 들어감
 * <p>
 * 11/17 QA: 예전엔 잠금(synchronized) 안에서 잠들어, 한 사람이 서로 다른 종목을 계속 물으면 요청 스레드가
 * 모두 줄에서 기다리다 기사 목록처럼 시세와 상관없는 API 까지 멈출 수 있었음.
 * 이제 잠금 안에서는 "내 순번 시각"만 정하고 잠은 잠금 밖에서. 줄이 MAX_WAIT 보다 길면 기다리지 않고 바로 429(QUOTE_BUSY)
 */
@Component
@ConditionalOnProperty(name = "KIS_ENABLED", havingValue = "true")
public class KisRateLimiter {

    static final long MAX_WAIT_NANOS = 10_000_000_000L;   // 줄이 10초보다 길면 기다리지 않음

    private final long minIntervalNanos;
    private long nextAllowedAt = 0;

    public KisRateLimiter(@Value("${KIS_REST_MIN_INTERVAL_MS:500}") long minIntervalMs) {
        this.minIntervalNanos = minIntervalMs * 1_000_000L;
    }

    /** 내 차례가 될 때까지 기다림. 줄이 너무 길면 EGW00201(초당 한도)과 같은 429 로 바로 돌려보냄 */
    public void acquire() {
        long wait = reserve(System.nanoTime());
        if (wait > 0) {
            try {
                Thread.sleep(wait / 1_000_000L, (int) (wait % 1_000_000L));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new KisApiException("INTERRUPTED", "기다리는 중 중단됨");
            }
        }
    }

    /** 순번을 잡고 기다릴 시간(ns)을 돌려줌. 너무 길면 순번을 잡지 않고 예외 */
    synchronized long reserve(long now) {
        long slot = Math.max(now, nextAllowedAt);
        if (slot - now > MAX_WAIT_NANOS) {
            throw new KisApiException("EGW00201", "요청이 많아 잠시 뒤 다시 시도해 주세요");
        }
        nextAllowedAt = slot + minIntervalNanos;
        return slot - now;
    }
}
