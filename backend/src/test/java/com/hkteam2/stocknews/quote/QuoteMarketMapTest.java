package com.hkteam2.stocknews.quote;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.util.List;

import org.junit.jupiter.api.Test;

/** 종목 지도: 우선주 빼기, 업종 붙이기·하루 캐시, 업종을 못 받으면 '기타' (KIS 는 가짜) */
class QuoteMarketMapTest {

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
        QuoteService service = new QuoteService(kis, null, null, null, null, null, null);

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
    void 우선주_판정() {
        assertThat(QuoteService.isPreferred("005935", "삼성전자우")).isTrue();
        assertThat(QuoteService.isPreferred("005380", "현대차")).isFalse();
        assertThat(QuoteService.isPreferred("005387", "현대차2우B")).isTrue();
        assertThat(QuoteService.isPreferred("051910", "LG화학")).isFalse();
    }
}
