package com.hkteam2.stocknews.quote;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

import org.junit.jupiter.api.Test;

/** 종목 지도: 우선주 빼기, 업종 붙이기·하루 캐시, 업종을 못 받으면 '기타', 장 밖엔 거래소 값 (KIS 는 가짜) */
class QuoteMarketMapTest {

    static final ZoneId KST = ZoneId.of("Asia/Seoul");

    static Clock at(String isoLocal) {
        return Clock.fixed(LocalDateTime.parse(isoLocal).atZone(KST).toInstant(), KST);
    }

    static QuoteService service(KisRestClient kis, String isoLocal) {
        return new QuoteService(kis, null, null, null, null, null, null, at(isoLocal));
    }

    static KisPrice price(String code, String sector) {
        return new KisPrice(code, 100, 0, "3", BigDecimal.ZERO, 0, 0, 0, 0, 0, sector);
    }

    @Test
    void 우선주는_빼고_업종을_붙이며_업종은_다시_묻지_않는다() {
        KisRestClient kis = mock(KisRestClient.class);
        when(kis.rankMarketCap("0001")).thenReturn(List.of(
                new KisRestClient.CapRankRow("005930", "삼성전자", "197000", "5", "-4.32", "11523015"),
                new KisRestClient.CapRankRow("005935", "삼성전자우", "162600", "5", "-4.63", "1304656"),
                new KisRestClient.CapRankRow("000660", "SK하이닉스", "1127000", "1", "29.98", "8232649")));
        when(kis.rankMarketCap("1001")).thenReturn(List.of());
        when(kis.inquirePrice("005930")).thenReturn(price("005930", "전기·전자"));
        when(kis.inquirePrice("000660")).thenThrow(new KisApiException("EGW00201", "초당 거래건수 초과"));
        QuoteService service = service(kis, "2026-11-17T10:00:00");   // 화요일 장중

        MarketMapResponse r = service.marketMap();

        assertThat(r.items()).extracting(MarketMapResponse.Item::stockCode).containsExactly("005930", "000660");
        assertThat(r.items().get(0).sector()).isEqualTo("전기·전자");
        assertThat(r.items().get(0).marketCap()).isEqualTo(11523015L);
        assertThat(r.items().get(0).changeRate()).isEqualByComparingTo("-4.32");
        assertThat(r.items().get(1).sector()).isEqualTo("기타");
        assertThat(r.items().get(1).priceLimit()).isEqualTo("UPPER");

        service.marketMap();   // 60초 캐시 → KIS 순위·업종을 다시 안 부름
        verify(kis, times(1)).rankMarketCap("0001");
        verify(kis, times(1)).inquirePrice("005930");
    }

    @Test
    void 장이_끝나면_순위의_넥스트레이드_값_대신_거래소_현재가를_쓴다() {
        // 2026-11-16 밤 실제: 순위 API 195,000 −5.34%(NXT 종가) / 거래소 종가 196,800 −4.47%
        KisRestClient kis = mock(KisRestClient.class);
        when(kis.rankMarketCap("0001")).thenReturn(List.of(
                new KisRestClient.CapRankRow("005930", "삼성전자", "195000", "5", "-5.34", "11523015"),
                new KisRestClient.CapRankRow("000660", "SK하이닉스", "1127000", "2", "3.00", "8232649")));
        when(kis.rankMarketCap("1001")).thenReturn(List.of());
        when(kis.inquirePrice("005930")).thenReturn(
                new KisPrice("005930", 196800, -9200, "5", new BigDecimal("-4.47"), 0, 0, 0, 0, 0, "전기·전자"));
        when(kis.inquirePrice("000660")).thenThrow(new KisApiException("EGW00201", "초당 거래건수 초과"));
        QuoteService service = service(kis, "2026-11-16T22:12:00");   // 월요일 밤

        MarketMapResponse r = service.marketMap();

        assertThat(r.items().get(0).price()).isEqualTo(196800L);
        assertThat(r.items().get(0).changeRate()).isEqualByComparingTo("-4.47");
        assertThat(r.items().get(0).marketCap()).isEqualTo(11523015L);   // 크기는 순위 값 그대로
        assertThat(r.items().get(1).price()).isEqualTo(1127000L);        // 거래소 값을 못 받으면 순위 값 (지도는 나옴)
        // 11/17: 장 밖엔 거래소 현재가 응답의 업종을 같이 써서 종목당 KIS 를 한 번만 부름 (예전엔 두 번)
        assertThat(r.items().get(0).sector()).isEqualTo("전기·전자");
        verify(kis, times(1)).inquirePrice("005930");
    }

    @Test
    void 거래소_정규장_판정() {
        assertThat(QuoteService.krxSession(LocalDateTime.parse("2026-11-17T08:59:59"))).isFalse();
        assertThat(QuoteService.krxSession(LocalDateTime.parse("2026-11-17T09:00:00"))).isTrue();
        assertThat(QuoteService.krxSession(LocalDateTime.parse("2026-11-17T15:30:40"))).isTrue();   // 종가 단일가 체결
        assertThat(QuoteService.krxSession(LocalDateTime.parse("2026-11-17T15:31:00"))).isFalse();
        assertThat(QuoteService.krxSession(LocalDateTime.parse("2026-11-16T17:33:00"))).isFalse();  // 시간외 단일가
        assertThat(QuoteService.krxSession(LocalDateTime.parse("2026-11-15T10:00:00"))).isFalse();  // 일요일
    }

    @Test
    void 우선주_판정() {
        assertThat(QuoteService.isPreferred("005935", "삼성전자우")).isTrue();
        assertThat(QuoteService.isPreferred("005380", "현대차")).isFalse();
        assertThat(QuoteService.isPreferred("005387", "현대차2우B")).isTrue();
        assertThat(QuoteService.isPreferred("051910", "LG화학")).isFalse();
    }
}
