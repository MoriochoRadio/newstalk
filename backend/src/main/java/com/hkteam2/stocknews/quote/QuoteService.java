package com.hkteam2.stocknews.quote;

import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.function.Function;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;

import com.hkteam2.stocknews.common.TimeUtils;

/**
 * 시세 조회 ("주방"): KIS 답을 우리 API 모양으로 바꾸고, 짧은 캐시로 KIS 호출을 줄임
 *
 * | 무엇 | 캐시 | KIS 호출 |
 * | 현재가 | 5초 | 1번 |
 * | 현재가 여러 종목 (홈·관심 종목) | 종목마다 5초 (현재가와 같은 캐시) | 캐시에 없는 종목만 모아 1번 (30종목까지) |
 * | 분봉 1·5·10·30분 (그날 하루) | 오늘 장중 60초, 15:40 이후·지난 날 하루 | 4번 동시에 (120분 구간씩), 주말 0번 → 서버가 n분씩 묶음 |
 * | 주·월·년봉 | 10분 | 1번 (최근 100개, 년봉은 상장 이후) |
 * | 일봉 1년 (차트 첫 화면 + 급등·급락 이력, 같은 캐시) | 10분 | 3번 (140일씩 나눠서) |
 * | 일·주·월봉 이어 받기 (to 이전 100개) | 1시간 | 1번 |
 * | 최근 체결 | 5초 | 1번 (30건) |
 * KIS_ENABLED=true 일 때만 만들어짐. 꺼져 있으면 QuoteController가 503 QUOTE_DISABLED
 */
@Service
@ConditionalOnProperty(name = "KIS_ENABLED", havingValue = "true")
public class QuoteService {

    private static final Logger log = LoggerFactory.getLogger(QuoteService.class);

    static final Duration PRICE_TTL = Duration.ofSeconds(5);
    /** 장 밖 현재가 캐시: 거래소 값이 안 바뀌는데 방송 보는 종목마다 밤새 5초에 한 번 묻던 것 (11/17) */
    static final Duration OFF_HOURS_QUOTE_TTL = Duration.ofSeconds(60);
    static final Duration MARKET_MAP_TTL = Duration.ofSeconds(60);   // 시가총액 순위 (코스피·코스닥 2번)
    static final Duration SECTOR_TTL = Duration.ofHours(24);
    private static final int MAP_THREADS = 8;   // 종목 지도 업종 조회 동시 수 (초당 한도는 줄 서기가 따로 지킴)         // 업종은 거의 안 바뀜 → 종목당 하루 1번
    /** 장 밖 지도 값을 거래소 현재가로 바꿀 때 캐시 (장이 끝나면 거래소 값은 다음 장까지 안 바뀜 → 길게) */
    static final Duration OFF_HOURS_PRICE_TTL = Duration.ofMinutes(30);
    static final Duration MINUTE_TTL = Duration.ofSeconds(60);
    static final Duration DAY_TTL = Duration.ofMinutes(10);
    static final Duration TICK_TTL = Duration.ofSeconds(5);
    /**
     * 지난 날 분봉은 바뀌지 않으므로 길게 (11/18: 1시간 → 하루). 종목 화면 5분봉은 오전에 지난 날을 며칠 더 받는데
     * 하루치가 KIS 4번 → 같은 종목을 다시 열 때 다시 묻지 않게. 하루치 1분봉은 약 390개라 메모리 부담은 작음
     */
    static final Duration PAST_MINUTE_TTL = Duration.ofHours(24);
    /** 지난 구간 일·주·월봉 (to 있음)도 바뀌지 않으므로 길게 */
    static final Duration PAST_PERIOD_TTL = Duration.ofHours(1);
    /** 09:00~15:30 = 391분, KIS는 한 번에 120분 → 4구간 (+ 여유 1) */
    private static final int MINUTE_PAGES = 5;
    /** KIS 분봉 한 번에 거꾸로 120줄 */
    private static final int MINUTE_WINDOW_MINUTES = 120;
    /** 이 시각이 지나면 오늘 분봉도 다 나온 것 (15:30 종가 단일가 봉이 들어올 여유 10분) */
    static final java.time.Duration MINUTE_SETTLE_AFTER_CLOSE = java.time.Duration.ofMinutes(10);
    /** KIS 분봉 보관 기간 (공식 예제 주석: 최대 1년) */
    static final int MINUTE_HISTORY_DAYS = 365;
    /** KIS 일봉은 한 번에 100개까지 → 달력 140일씩 (거래일 약 96일) */
    private static final int DAILY_CHUNK_DAYS = 140;
    /** 1년 + 앞쪽 여유 (첫날 등락률을 내려면 그 전 거래일 종가가 필요, 연휴 대비 2주) */
    private static final int YEAR_DAYS = 366 + 14;

    /** 실시간 현재가가 이만큼 안에 갱신됐으면 KIS에 묻지 않고 그 값을 씀 */
    static final Duration LIVE_FRESH = Duration.ofSeconds(15);

    private final KisRestClient kis;
    private final KisProperties props;
    private final KisWebSocketClient realtime;
    private final TickBuffer buffer;
    private final TickWriter writer;
    private final QuoteMapper mapper;
    private final SubscriptionManager subscriptions;
    private final QuoteCache cache;
    private final Clock clock;

    @Autowired   // 생성자가 둘이라 Spring 이 쓸 것을 표시
    public QuoteService(KisRestClient kis, KisProperties props, KisWebSocketClient realtime, TickBuffer buffer,
                        TickWriter writer, QuoteMapper mapper, SubscriptionManager subscriptions) {
        this(kis, props, realtime, buffer, writer, mapper, subscriptions, Clock.system(TimeUtils.KST));
    }

    /** 테스트용: 시각을 고정해서 장중·장 밖을 나눠 확인 */
    QuoteService(KisRestClient kis, KisProperties props, KisWebSocketClient realtime, TickBuffer buffer,
                 TickWriter writer, QuoteMapper mapper, SubscriptionManager subscriptions, Clock clock) {
        this.kis = kis;
        this.props = props;
        this.realtime = realtime;
        this.buffer = buffer;
        this.writer = writer;
        this.mapper = mapper;
        this.subscriptions = subscriptions;
        this.clock = clock;
        this.cache = new QuoteCache(clock);
    }

    /**
     * 현재가. 실시간으로 받고 있는 종목이면 DB의 현재가(quote_snapshot)를 바로 씀 (KIS 호출 0, live=true)
     * 아니면 KIS REST 조회 + 5초 캐시
     */
    public QuoteResponse price(String stockCode) {
        QuoteSnapshotRow s = mapper.findSnapshot(stockCode);
        if (isLive(s)) {
            return fromSnapshot(s);
        }
        return cache.get("price:" + stockCode, priceTtl(), () -> fromKis(kis.inquirePrice(stockCode)));
    }

    /**
     * 현재가 여러 종목 (홈 목록·관심 종목). 순서는 codes 순서, 못 받은 종목은 빠짐
     * 11/18: 예전엔 종목마다 KIS를 따로 불러 10종목에 줄 서기 간격(0.1초) × 10 + 응답 = 홈 첫 화면 1.6~2.1초.
     * 이제 ① 실시간으로 받는 종목은 DB 현재가 ② 5초 안에 물어본 종목은 캐시 ③ 나머지만 모아 KIS 한 번(멀티종목 시세)
     * 한 번에 묻기가 실패하면 그 종목들만 예전처럼 하나씩 (한 종목 문제로 목록 전체가 비지 않게)
     */
    public List<QuoteResponse> prices(List<String> codes) {
        if (codes.isEmpty()) {
            return List.of();
        }
        Map<String, QuoteResponse> found = new java.util.HashMap<>();
        for (QuoteSnapshotRow s : mapper.findSnapshots(codes)) {
            if (isLive(s)) {
                found.put(s.stockCode(), fromSnapshot(s));
            }
        }
        List<String> missing = new ArrayList<>();
        for (String code : codes.stream().distinct().toList()) {
            if (found.containsKey(code)) {
                continue;
            }
            QuoteResponse cached = cache.peek("price:" + code);
            if (cached != null) {
                found.put(code, cached);
            } else {
                missing.add(code);
            }
        }
        Duration ttl = priceTtl();
        for (int from = 0; from < missing.size(); from += KisRestClient.MULTI_PRICE_MAX) {
            List<String> chunk = missing.subList(from, Math.min(missing.size(), from + KisRestClient.MULTI_PRICE_MAX));
            try {
                for (KisPrice p : kis.inquireMultiPrice(chunk)) {
                    QuoteResponse q = fromKis(p);
                    cache.put("price:" + p.stockCode(), ttl, q);
                    found.put(p.stockCode(), q);
                }
            } catch (KisApiException e) {
                log.warn("여러 종목 현재가 한 번에 묻기 실패 ({}), 하나씩 다시: {}", e.getMessage(), chunk);
                for (String code : chunk) {
                    try {
                        found.put(code, price(code));
                    } catch (KisApiException one) {
                        log.warn("시세 조회 실패 {}: {}", code, one.getMessage());
                    }
                }
            }
        }
        return codes.stream().map(found::get).filter(java.util.Objects::nonNull).toList();
    }

    /** 장중 5초, 장 밖 60초 (장 밖 값은 거의 안 바뀜) */
    private Duration priceTtl() {
        return krxSession(LocalDateTime.now(clock)) ? PRICE_TTL : OFF_HOURS_QUOTE_TTL;
    }

    /** KIS 현재가 → API 응답 (live=false, 시각은 지금) */
    private QuoteResponse fromKis(KisPrice p) {
        return new QuoteResponse(p.stockCode(), p.price(), p.changeAmount(), p.changeRate(),
                direction(p.changeSign()), p.open(), p.high(), p.low(), p.accVolume(),
                TimeUtils.toKst(LocalDateTime.now(clock)), false, priceLimit(p.changeSign()));
    }

    /**
     * 종목 지도 재료: 코스피·코스닥 시가총액 상위 각 30개 (우선주는 보통주와 겹쳐 뺌) + 업종
     * 순위는 60초 캐시(KIS 2번), 업종은 종목마다 하루 캐시(현재가 API 의 업종 칸). 업종을 못 받으면 "기타"
     * <p>
     * 장 밖(평일 09:00 전·15:31 이후, 주말)에는 값과 등락률을 거래소(J) 현재가로 바꿈: 순위 API 는 장이 끝난 뒤
     * 넥스트레이드(NXT, 20:00 까지) 체결가를 줌 → 2026-11-16 밤 삼성전자가 지도엔 195,000 −5.34%(NXT 종가),
     * 차트·크게 움직인 날엔 196,800 −4.47%(거래소 종가)로 달랐음. 장중 순위 값은 거래소 값(거래량으로 확인)이라 그대로
     */
    public MarketMapResponse marketMap() {
        boolean offHours = !krxSession(LocalDateTime.now(clock));
        return cache.get(offHours ? "market-map:off" : "market-map", MARKET_MAP_TTL, () -> {
            record Row(KisRestClient.CapRankRow r, String market) {
            }
            List<Row> rows = new ArrayList<>();
            for (String[] m : new String[][] {{"0001", "KOSPI"}, {"1001", "KOSDAQ"}}) {
                for (KisRestClient.CapRankRow r : kis.rankMarketCap(m[0])) {
                    if (r.code() != null && !isPreferred(r.code(), r.name())) {
                        rows.add(new Row(r, m[1]));
                    }
                }
            }
            // 종목마다 업종(·장 밖 거래소 현재가)을 동시에 물음 (11/17): 예전엔 약 58종목을 한 줄로 물어
            // 서버를 막 켠 뒤 첫 지도가 30~60초 걸렸음. 초당 한도는 KIS 줄 서기(KisRateLimiter)가 지킴.
            // 장 밖엔 거래소 현재가 응답에 업종도 들어 있어 같은 종목을 두 번 묻지 않음
            List<MapExtra> extras = inParallel(rows, row -> extra(row.r().code(), offHours), MAP_THREADS);
            List<MarketMapResponse.Item> items = new ArrayList<>();
            for (int i = 0; i < rows.size(); i++) {
                KisRestClient.CapRankRow r = rows.get(i).r();
                MapExtra x = extras.get(i);
                String name = r.name() == null ? r.code() : r.name().strip();
                if (x.krx() != null) {
                    items.add(new MarketMapResponse.Item(r.code(), name, rows.get(i).market(), x.sector(),
                            parseLong(r.marketCap()), x.krx().price(), x.krx().changeRate(), priceLimit(x.krx().changeSign())));
                } else {
                    items.add(new MarketMapResponse.Item(r.code(), name, rows.get(i).market(), x.sector(),
                            parseLong(r.marketCap()), parseLong(r.price()),
                            parseDecimal(r.changeRate()), priceLimit(r.changeSign())));
                }
            }
            return new MarketMapResponse(items, TimeUtils.toKst(LocalDateTime.now(clock)));
        });
    }

    private record MapExtra(String sector, KisPrice krx) {
    }

    /** 지도 한 칸에 더 붙일 것. 실패해도 예외 없이 ("기타", 순위 값) */
    private MapExtra extra(String code, boolean offHours) {
        KisPrice krx = offHours ? krxPrice(code) : null;
        if (krx != null && krx.sector() != null && !krx.sector().isBlank()) {
            cache.put("sector:" + code, SECTOR_TTL, krx.sector());   // 같은 응답의 업종 → 업종을 따로 묻지 않음
        }
        return new MapExtra(sectorOf(code), krx);
    }

    /**
     * 서버가 켜지고 5초 뒤 종목 지도를 한 번 미리 만들어 둠 (11/17): 시연 직전에 재시작해도 첫 화면이 바로 뜨게.
     * 업종은 하루 캐시라 그 뒤 지도는 순위 2번만 물음. 실패해도 첫 요청이 다시 만들 뿐
     */
    @EventListener(ApplicationReadyEvent.class)
    public void warmUpMarketMap() {
        CompletableFuture.runAsync(() -> {
            try {
                marketMap();
                log.info("종목 지도 미리 만들어 둠");
            } catch (RuntimeException e) {
                log.warn("종목 지도 미리 만들기 실패 (첫 요청 때 다시 만듦): {}", e.getMessage());
            }
        }, CompletableFuture.delayedExecutor(5, TimeUnit.SECONDS));
    }

    /** 장 밖 거래소 현재가 (30분 캐시). 못 받으면 null → 순위 값 그대로 (지도 전체를 실패시키지 않음) */
    private KisPrice krxPrice(String code) {
        try {
            return cache.get("krx-price:" + code, OFF_HOURS_PRICE_TTL, () -> kis.inquirePrice(code));
        } catch (RuntimeException e) {
            return null;
        }
    }

    /** 거래소 정규장인지: 평일 09:00 ~ 15:31 (공휴일은 모름 — 그날은 순위·현재가 모두 지난 거래일 값이라 괜찮음) */
    static boolean krxSession(LocalDateTime now) {
        // 마감 시각의 종가 단일가 체결이 들어올 여유 1분. 장 시간은 날마다 다를 수 있음 (수능일 10:00~16:30, MarketHours)
        LocalTime t = now.toLocalTime();
        return MarketHours.weekday(now.toLocalDate()) && !t.isBefore(MarketHours.open(now.toLocalDate()))
                && t.isBefore(MarketHours.close(now.toLocalDate()).plusMinutes(1));
    }

    private String sectorOf(String code) {
        try {
            return cache.get("sector:" + code, SECTOR_TTL, () -> {
                String s = kis.inquirePrice(code).sector();
                return s == null || s.isBlank() ? "기타" : s;
            });
        } catch (RuntimeException e) {
            return "기타";   // 업종 하나 못 받았다고 지도 전체를 실패시키지 않음
        }
    }

    /** 우선주: 종목코드 끝자리가 0이 아니거나 이름이 '우'·'우B' 등으로 끝남 (삼성전자우 005935) */
    static boolean isPreferred(String code, String name) {
        return !code.endsWith("0") || (name != null && name.strip().matches(".*우[A-C]?(\\(전환\\))?$"));
    }

    private static long parseLong(String s) {
        try {
            return s == null || s.isBlank() ? 0 : Long.parseLong(s.strip());
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private static java.math.BigDecimal parseDecimal(String s) {
        try {
            return s == null || s.isBlank() ? java.math.BigDecimal.ZERO : new java.math.BigDecimal(s.strip());
        } catch (NumberFormatException e) {
            return java.math.BigDecimal.ZERO;
        }
    }

    /** 오늘 날짜 (한국 시간). 분봉 날짜를 고를 때 기준 */
    public LocalDate today() {
        return LocalDate.now(clock);
    }

    /**
     * 분봉 차트: date 하루(09:00~15:30)의 1분봉을 받아 unit 분씩 묶음. 오래된 것부터
     * 1분봉 원본은 날짜마다 캐시해서 5·10·30분봉으로 바꿔 봐도 KIS를 다시 부르지 않음
     */
    public ChartResponse minuteChart(String stockCode, ChartUnit unit, LocalDate date) {
        List<KisCandle> oneMinute = oneMinuteCandles(stockCode, date);
        return new ChartResponse(stockCode, unit.code(), date,
                toCandles(CandleAggregator.aggregate(oneMinute, unit.minutes())));
    }

    /**
     * 그날 1분봉 전부. 그날·장 시간(09:00~15:30) 것만 남김
     *
     * 15:30(오늘 장중이면 지금)부터 120분 간격으로 끊은 구간(15:30·13:30·11:30·09:30)을 KIS에 **한꺼번에** 물음.
     * 예전에는 한 구간 답을 받고 나서 다음 구간을 물어(KIS 한 번에 약 1초 × 4번) 첫 조회가 5초쯤 걸렸음 (QA #7)
     * - 구간끼리는 서로의 답이 필요 없어서 동시에 물어도 됨. 줄 서기(KisRateLimiter)는 그대로라 KIS 한도는 지킴
     * - KIS는 구간마다 거꾸로 120줄을 줌. 거래 없는 분(15:20~15:30 단일가 등)은 줄이 없어서 120분보다 길게 덮음
     *   → 구간끼리 겹치기만 하고 빈틈은 생기지 않음. 겹치는 분은 하나로 합침
     * - 주말은 장이 없으니 KIS에 묻지 않음 (화면이 빈 날을 건너 앞 영업일을 물을 때 헛호출 4번을 막음)
     */
    List<KisCandle> oneMinuteCandles(String stockCode, LocalDate date) {
        if (date.getDayOfWeek() == DayOfWeek.SATURDAY || date.getDayOfWeek() == DayOfWeek.SUNDAY) {
            return List.of();
        }
        LocalDateTime now = LocalDateTime.now(clock).withNano(0);
        boolean isToday = date.equals(now.toLocalDate());
        // 오늘이라도 장이 끝나고 조금 지나면(15:40) 더 바뀌지 않으므로 지난 날처럼 길게
        LocalTime open = MarketHours.open(date);
        LocalTime close = MarketHours.close(date);   // 수능일은 10:00~16:30
        boolean settled = !isToday || !now.toLocalTime().isBefore(close.plus(MINUTE_SETTLE_AFTER_CLOSE));
        return cache.get("m1:" + stockCode + ":" + date, settled ? PAST_MINUTE_TTL : MINUTE_TTL, () -> {
            LocalTime until = isToday && now.toLocalTime().isBefore(close) ? now.toLocalTime() : close;
            List<LocalTime> windows = new ArrayList<>();
            for (LocalTime t = until; !t.isBefore(open) && windows.size() < MINUTE_PAGES;
                 t = t.minusMinutes(MINUTE_WINDOW_MINUTES)) {
                windows.add(t);
            }
            Map<LocalDateTime, KisCandle> byTime = new TreeMap<>();   // 시각 순 + 겹치는 분 하나로
            for (List<KisCandle> rows : inParallel(windows, t -> kis.inquireMinuteCandles(stockCode, date, t))) {
                for (KisCandle c : rows) {
                    LocalTime t = c.time().toLocalTime();
                    // 장 시작 앞으로 넘어가면 전날 시간외 봉이 섞여 옴 → 그날 09:00~15:30만
                    if (c.time().toLocalDate().equals(date) && !t.isBefore(open) && !t.isAfter(close)) {
                        byTime.put(c.time(), c);
                    }
                }
            }
            return List.copyOf(byTime.values());
        });
    }

    /**
     * 여러 KIS 조회를 동시에 보내고, 보낸 순서대로 답을 모음. 하나라도 실패하면 그 오류를 그대로 던짐
     * (KisApiException 그대로 → QuoteExceptionHandler가 429·502로 바꿈)
     * 일꾼(스레드)은 부를 때마다 구간 수만큼 만들고 끝나면 닫음. 분봉은 캐시가 있어 새로 만드는 일이 드묾
     */
    private static <T, R> List<R> inParallel(List<T> inputs, Function<T, R> call) {
        return inParallel(inputs, call, inputs.size());
    }

    /** 일꾼을 최대 maxThreads 개만 (종목 지도처럼 입력이 수십 개일 때) */
    private static <T, R> List<R> inParallel(List<T> inputs, Function<T, R> call, int maxThreads) {
        if (inputs.isEmpty()) {
            return List.of();
        }
        try (ExecutorService pool = Executors.newFixedThreadPool(Math.min(inputs.size(), maxThreads))) {
            List<Future<R>> futures = inputs.stream().map(in -> pool.submit(() -> call.apply(in))).toList();
            List<R> out = new ArrayList<>();
            for (Future<R> f : futures) {
                out.add(f.get());
            }
            return out;
        } catch (ExecutionException e) {
            if (e.getCause() instanceof RuntimeException re) {
                throw re;
            }
            throw new KisApiException("PARALLEL_FAILED", String.valueOf(e.getCause()));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new KisApiException("INTERRUPTED", "기다리는 중 중단됨");
        }
    }

    /** 일·주·월·년봉 최근 (to 없음) */
    public ChartResponse periodChart(String stockCode, ChartUnit unit) {
        return periodChart(stockCode, unit, null);
    }

    /**
     * 일·주·월·년봉. 오래된 것부터
     * - to 없음 (첫 화면): 일봉은 1년 치 = 급등·급락 이력과 같은 캐시를 씀 (KIS 추가 호출 0).
     *   주·월봉은 최근 100개 (주봉 95주, 월봉 95개월), 년봉은 상장 이후 전체 (99년)
     * - to 있음 (화면을 왼쪽으로 끌 때 이어 받기): to(포함)까지 거꾸로 100개 이내 = KIS 1번.
     *   지난 구간은 값이 바뀌지 않으므로 1시간 캐시
     */
    public ChartResponse periodChart(String stockCode, ChartUnit unit, LocalDate to) {
        if (to == null && unit == ChartUnit.DAY) {
            return new ChartResponse(stockCode, unit.code(), null, toCandles(yearDailyCandles(stockCode)));
        }
        // 이름표 앞에 용도(chart:)를 붙임. 예전에는 "year:"가 아래 yearDailyCandles와 겹쳐 년봉이 일봉 목록을 꺼내 500이 났음
        String key = "chart:" + unit.code() + ":" + stockCode + (to == null ? "" : ":" + to);
        return cache.get(key, to == null ? DAY_TTL : PAST_PERIOD_TTL, () -> {
            LocalDate end = to == null ? today() : to;
            LocalDate from = switch (unit) {
                case WEEK -> end.minusWeeks(95);
                case MONTH -> end.minusMonths(95);
                case YEAR -> end.minusYears(99);
                default -> end.minusDays(150);   // 달력 150일 = 거래일 약 100일
            };
            List<KisCandle> rows = new ArrayList<>(kis.inquirePeriodCandles(stockCode, from, end, unit.periodCode()));
            rows.sort(Comparator.comparing(KisCandle::time));
            return new ChartResponse(stockCode, unit.code(), null, toCandles(rows));
        });
    }

    /**
     * 일봉 약 1년 치 (급등·급락 이력용), 오래된 것부터
     * 오늘부터 거꾸로 140일씩 나눠 KIS에 물음 (3번). 경계에서 겹치는 날은 하나로
     */
    public List<KisCandle> yearDailyCandles(String stockCode) {
        return cache.get("daily1y:" + stockCode, DAY_TTL, () -> {
            LocalDate today = LocalDate.now(clock);
            LocalDate start = today.minusDays(YEAR_DAYS);
            Map<LocalDateTime, KisCandle> byDate = new TreeMap<>();
            for (LocalDate end = today; !end.isBefore(start); ) {
                LocalDate from = end.minusDays(DAILY_CHUNK_DAYS - 1);
                if (from.isBefore(start)) {
                    from = start;
                }
                kis.inquireDailyCandles(stockCode, from, end).forEach(c -> byDate.put(c.time(), c));
                end = from.minusDays(1);
            }
            return List.copyOf(byDate.values());
        });
    }

    /** 최근 체결 30건 (최신이 앞) */
    public List<TickResponse> ticks(String stockCode) {
        return cache.get("ticks:" + stockCode, TICK_TTL, () -> {
            LocalDate today = LocalDate.now(clock);
            return kis.inquireRecentTicks(stockCode).stream()
                    .map(t -> new TickResponse(TimeUtils.toKst(today.atTime(t.time())), t.price(), t.changeAmount(),
                            t.changeRate(), direction(t.changeSign()), t.volume(), t.strength()))
                    .toList();
        });
    }

    /**
     * 실시간 현재가 줄이 최근(15초 안)에 갱신됐는지 = 지금 생중계로 받고 있는지
     * 정규장 밖은 생중계 값을 쓰지 않음: 웹소켓이 16:00~18:00 시간외 단일가 체결도 보내서(11/16 17:33 197,100)
     * 종가(196,800) 대신 그 값이 현재가로 보였음 → 장 밖은 거래소 현재가 REST
     */
    boolean isLive(QuoteSnapshotRow s) {
        LocalDateTime now = LocalDateTime.now(clock);
        return s != null && krxSession(now) && s.updatedAt().isAfter(now.minus(LIVE_FRESH));
    }

    /** DB 현재가 줄 → API 응답 (live=true) */
    static QuoteResponse fromSnapshot(QuoteSnapshotRow s) {
        return new QuoteResponse(s.stockCode(), s.price(), s.changeAmount(), s.changeRate(),
                direction(s.changeSign()), s.openPrice(), s.highPrice(), s.lowPrice(), s.accVolume(),
                TimeUtils.toKst(s.tradedAt()), true, priceLimit(s.changeSign()));
    }

    /** 실시간 수집 상태 */
    public QuoteStatusResponse status() {
        return new QuoteStatusResponse(props.mode(), realtime.connected(), TimeUtils.toKst(realtime.connectedAt()),
                TimeUtils.toKst(realtime.lastMessageAt()), subscriptions.capacity(), subscriptions.fixedCodes(),
                subscriptions.activeCodes(), realtime.subscribedCodes(), subscriptions.waitingCodes(),
                subscriptions.viewers(),
                realtime.messages(), buffer.received(), writer.saved(), buffer.dropped(), writer.failed(),
                buffer.size(), realtime.quarantined(), realtime.reconnects(), mapper.countTicks(LocalDate.now(clock)));
    }

    /** KIS 전일 대비 부호 → 상한가·하한가 (1 상한 → UPPER, 4 하한 → LOWER, 나머지 null) */
    static String priceLimit(String kisSign) {
        if ("1".equals(kisSign)) {
            return "UPPER";
        }
        if ("4".equals(kisSign)) {
            return "LOWER";
        }
        return null;
    }

    /** KIS 전일 대비 부호 → 화면용. 1 상한·2 상승 → UP, 4 하한·5 하락 → DOWN, 3 보합 → FLAT */
    static String direction(String kisSign) {
        if ("1".equals(kisSign) || "2".equals(kisSign)) {
            return "UP";
        }
        if ("4".equals(kisSign) || "5".equals(kisSign)) {
            return "DOWN";
        }
        return "FLAT";
    }

    private static List<ChartResponse.Candle> toCandles(Iterable<KisCandle> candles) {
        List<ChartResponse.Candle> out = new ArrayList<>();
        for (KisCandle c : candles) {
            out.add(new ChartResponse.Candle(TimeUtils.toKst(c.time()), c.open(), c.high(), c.low(), c.close(), c.volume()));
        }
        return out;
    }
}
