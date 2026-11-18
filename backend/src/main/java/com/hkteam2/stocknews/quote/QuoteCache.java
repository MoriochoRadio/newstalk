package com.hkteam2.stocknews.quote;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

/**
 * 짧은 캐시 ("냉장고"): 같은 것을 몇 초 안에 또 물으면 KIS에 다시 묻지 않고 저장해 둔 답을 줌
 * 사용자가 여럿이어도 KIS 호출은 종목·종류마다 ttl에 한 번 → 초당 호출 한도를 지킴
 *
 * 같은 키를 여러 요청이 동시에 물으면 한 요청만 KIS에 가고 나머지는 그 결과를 기다려 씀 (키마다 잠금)
 * 실패한 결과는 저장하지 않음 (다음 요청이 다시 시도)
 * 11/17 QA: 지난 값을 지우지 않아 날짜를 바꿔 가며 분봉을 훑으면 끝없이 커졌음 → 새로 넣을 때 256번마다 만료된 것과 그 잠금을 지움
 */
class QuoteCache {

    private record Entry(Object value, Instant expiresAt) {
    }

    private final ConcurrentHashMap<String, Entry> entries = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Object> locks = new ConcurrentHashMap<>();
    private final Clock clock;
    private final java.util.concurrent.atomic.AtomicInteger puts = new java.util.concurrent.atomic.AtomicInteger();
    static final int PURGE_EVERY = 256;

    QuoteCache(Clock clock) {
        this.clock = clock;
    }

    @SuppressWarnings("unchecked")
    <T> T get(String key, Duration ttl, Supplier<T> loader) {
        Entry e = entries.get(key);
        if (fresh(e)) {
            return (T) e.value();
        }
        synchronized (locks.computeIfAbsent(key, k -> new Object())) {
            e = entries.get(key);
            if (fresh(e)) {
                return (T) e.value();   // 기다리는 동안 다른 요청이 채워 둠
            }
            T value = loader.get();
            store(key, ttl, value);
            return value;
        }
    }

    /** 아직 신선한 값이 있으면 그 값, 없으면 null (KIS에 묻지 않음). 여러 종목을 한 번에 물을 때 이미 있는 종목을 빼려고 */
    @SuppressWarnings("unchecked")
    <T> T peek(String key) {
        Entry e = entries.get(key);
        return fresh(e) ? (T) e.value() : null;
    }

    /** 다른 응답에서 함께 얻은 값을 넣어 둠 (예: 거래소 현재가 응답의 업종 → 업종 캐시) */
    void put(String key, Duration ttl, Object value) {
        store(key, ttl, value);
    }

    private void store(String key, Duration ttl, Object value) {
        entries.put(key, new Entry(value, clock.instant().plus(ttl)));
        if (puts.incrementAndGet() % PURGE_EVERY == 0) {
            purge();
        }
    }

    /** 만료된 값과, 값이 없는 키의 잠금을 지움 (지금 누가 쓰는 잠금을 지워도 다음 요청이 새 잠금을 만들 뿐) */
    void purge() {
        Instant now = clock.instant();
        entries.entrySet().removeIf(e -> !now.isBefore(e.getValue().expiresAt()));
        locks.keySet().removeIf(k -> !entries.containsKey(k));
    }

    int size() {
        return entries.size();
    }

    private boolean fresh(Entry e) {
        return e != null && clock.instant().isBefore(e.expiresAt());
    }
}
