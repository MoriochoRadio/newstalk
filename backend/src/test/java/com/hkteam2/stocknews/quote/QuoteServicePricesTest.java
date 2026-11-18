package com.hkteam2.stocknews.quote;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

import org.junit.jupiter.api.Test;

/**
 * 현재가 여러 종목 (11/18): 홈이 10종목을 물으면 KIS 10번 → 1번.
 * 실시간 종목은 DB, 5초 안에 물은 종목은 캐시, 나머지만 모아 한 번. 한 번에 묻기가 실패하면 하나씩
 */
class QuoteServicePricesTest {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    /** 2026-11-18 (수) 10:00 장중 */
    private static final LocalDateTime NOW = LocalDateTime.of(2026, 11, 18, 10, 0);

    private final KisRestClient kis = mock(KisRestClient.class);
    private final QuoteMapper mapper = mock(QuoteMapper.class);
    private final QuoteService service = new QuoteService(kis, null, null, null, null, mapper, null,
            Clock.fixed(NOW.atZone(KST).toInstant(), KST));

    private static KisPrice kisPrice(String code, long price) {
        return new KisPrice(code, price, -100, "5", new BigDecimal("-0.50"), 1000, price, price, price, 0, null);
    }

    @Test
    void 캐시에_없는_종목을_모아_KIS_한_번에_묻고_보낸_순서대로_준다() {
        when(mapper.findSnapshots(any())).thenReturn(List.of());
        when(kis.inquireMultiPrice(List.of("005930", "000660", "035720")))
                .thenReturn(List.of(kisPrice("005930", 197200), kisPrice("000660", 1160000), kisPrice("035720", 31700)));

        List<QuoteResponse> out = service.prices(List.of("005930", "000660", "035720"));

        assertThat(out).extracting(QuoteResponse::stockCode).containsExactly("005930", "000660", "035720");
        assertThat(out.get(0).changeAmount()).isEqualTo(-100);
        assertThat(out.get(0).direction()).isEqualTo("DOWN");
        assertThat(out.get(0).live()).isFalse();
        verify(kis, times(1)).inquireMultiPrice(anyList());
        verify(kis, never()).inquirePrice(any());
    }

    @Test
    void 실시간_종목과_5초_안에_물은_종목은_KIS에_다시_묻지_않는다() {
        QuoteSnapshotRow live = new QuoteSnapshotRow("005930", 197300, "2", 7000, new BigDecimal("3.68"),
                196900, 199950, 196000, 3100000, NOW.minusSeconds(1), NOW.minusSeconds(1));
        when(mapper.findSnapshots(any())).thenReturn(List.of(live));
        when(kis.inquireMultiPrice(List.of("000660"))).thenReturn(List.of(kisPrice("000660", 1160000)));
        service.prices(List.of("000660"));                      // 캐시에 넣음

        List<QuoteResponse> out = service.prices(List.of("005930", "000660"));

        assertThat(out).extracting(QuoteResponse::stockCode).containsExactly("005930", "000660");
        assertThat(out.get(0).live()).isTrue();
        assertThat(out.get(0).price()).isEqualTo(197300);
        verify(kis, times(1)).inquireMultiPrice(anyList());   // 처음 한 번뿐
    }

    @Test
    void 한_번에_묻기가_실패하면_하나씩_묻고_실패한_종목만_빠진다() {
        when(mapper.findSnapshots(any())).thenReturn(List.of());
        when(mapper.findSnapshot(any())).thenReturn(null);
        when(kis.inquireMultiPrice(anyList())).thenThrow(new KisApiException("EGW00201", "초당 거래건수 초과"));
        when(kis.inquirePrice("005930")).thenReturn(kisPrice("005930", 197200));
        when(kis.inquirePrice("000660")).thenThrow(new KisApiException("X", "실패"));

        List<QuoteResponse> out = service.prices(List.of("005930", "000660"));

        assertThat(out).extracting(QuoteResponse::stockCode).containsExactly("005930");
    }

    @Test
    void 없는_종목은_빠지고_빈_목록은_KIS를_부르지_않는다() {
        when(mapper.findSnapshots(any())).thenReturn(List.of());
        when(kis.inquireMultiPrice(List.of("005930", "999999"))).thenReturn(List.of(kisPrice("005930", 197200)));

        assertThat(service.prices(List.of("005930", "999999"))).extracting(QuoteResponse::stockCode).containsExactly("005930");
        assertThat(service.prices(List.of())).isEmpty();
        verify(kis, times(1)).inquireMultiPrice(anyList());
    }
}
