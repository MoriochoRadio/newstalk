package com.hkteam2.stocknews.quote;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/** KIS 전일 대비 부호 → 상한가·하한가 (1 상한, 2 상승, 3 보합, 4 하한, 5 하락) */
class QuotePriceLimitTest {

    @Test
    void 부호_1은_상한가_4는_하한가_나머지는_없음() {
        assertThat(QuoteService.priceLimit("1")).isEqualTo("UPPER");
        assertThat(QuoteService.priceLimit("4")).isEqualTo("LOWER");
        assertThat(QuoteService.priceLimit("2")).isNull();
        assertThat(QuoteService.priceLimit("5")).isNull();
        assertThat(QuoteService.priceLimit(null)).isNull();
        // 방향은 그대로: 상한도 UP, 하한도 DOWN
        assertThat(QuoteService.direction("1")).isEqualTo("UP");
        assertThat(QuoteService.direction("4")).isEqualTo("DOWN");
    }
}
