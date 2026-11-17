package com.hkteam2.stocknews.quote;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

import org.junit.jupiter.api.Test;

/** 정규장 시간: 보통 09:00~15:30, 수능일 10:00~16:30, 새해 첫 거래일 10:00 개장 */
class MarketHoursTest {

    @Test
    void 보통_날() {
        LocalDate tue = LocalDate.of(2026, 11, 17);
        assertThat(MarketHours.open(tue)).isEqualTo(LocalTime.of(9, 0));
        assertThat(MarketHours.close(tue)).isEqualTo(LocalTime.of(15, 30));
        assertThat(MarketHours.inSession(tue.atTime(15, 30))).isTrue();
        assertThat(MarketHours.inSession(tue.atTime(15, 30, 1))).isFalse();
        assertThat(MarketHours.inSession(LocalDateTime.of(2026, 11, 15, 10, 0))).isFalse();   // 일요일
    }

    @Test
    void 수능일과_새해_첫_거래일() {
        LocalDate csat = LocalDate.of(2026, 11, 19);
        assertThat(MarketHours.open(csat)).isEqualTo(LocalTime.of(10, 0));
        assertThat(MarketHours.close(csat)).isEqualTo(LocalTime.of(16, 30));
        assertThat(MarketHours.inSession(csat.atTime(9, 59))).isFalse();
        assertThat(MarketHours.inSession(csat.atTime(16, 15))).isTrue();
        assertThat(MarketHours.open(LocalDate.of(2026, 1, 2))).isEqualTo(LocalTime.of(10, 0));
        assertThat(MarketHours.close(LocalDate.of(2026, 1, 2))).isEqualTo(LocalTime.of(15, 30));
    }
}
