package com.hkteam2.stocknews.quote;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Map;

/**
 * 거래소(KRX) 정규장 시간. 보통 평일 09:00~15:30
 * <p>
 * 장 시간이 바뀌는 날 (2026-11-17 QA): 수능일은 한 시간씩 늦춰 10:00~16:30, 새해 첫 거래일은 10:00 개장.
 * 예전엔 09:00~15:30 이 여러 곳에 고정돼 있어 11/19(목) 수능일에 15:31~16:30 장중을 "장 마감"으로 보고
 * 종목 지도·현재가를 거래소 종가 값으로 바꾸고, 분봉 차트는 15:30 뒤 봉을 버렸을 것.
 * 공휴일(휴장일)은 따로 모름: 그날은 체결이 없어 화면 값이 지난 거래일 그대로라 큰 문제 없음
 */
public final class MarketHours {

    public static final LocalTime OPEN = LocalTime.of(9, 0);
    public static final LocalTime CLOSE = LocalTime.of(15, 30);

    /** 시간이 다른 날: 날짜 → {개장, 마감}. 근거: 거래소 공지 (수능일 개장·마감 1시간 늦춤, 새해 첫 거래일 10시 개장) */
    private static final Map<LocalDate, LocalTime[]> SPECIAL = Map.of(
            LocalDate.of(2025, 11, 13), new LocalTime[] {LocalTime.of(10, 0), LocalTime.of(16, 30)},   // 2026학년도 수능
            LocalDate.of(2026, 1, 2), new LocalTime[] {LocalTime.of(10, 0), CLOSE},                    // 2026 첫 거래일
            LocalDate.of(2026, 11, 19), new LocalTime[] {LocalTime.of(10, 0), LocalTime.of(16, 30)});  // 2027학년도 수능

    private MarketHours() {
    }

    public static LocalTime open(LocalDate date) {
        LocalTime[] s = SPECIAL.get(date);
        return s == null ? OPEN : s[0];
    }

    public static LocalTime close(LocalDate date) {
        LocalTime[] s = SPECIAL.get(date);
        return s == null ? CLOSE : s[1];
    }

    public static boolean weekday(LocalDate date) {
        DayOfWeek d = date.getDayOfWeek();
        return d != DayOfWeek.SATURDAY && d != DayOfWeek.SUNDAY;
    }

    /** 정규장 안인가: 평일 개장 ≤ now ≤ 마감 (마감 시각의 종가 단일가 체결까지 포함) */
    public static boolean inSession(LocalDateTime now) {
        LocalDate day = now.toLocalDate();
        LocalTime t = now.toLocalTime();
        return weekday(day) && !t.isBefore(open(day)) && !t.isAfter(close(day));
    }
}
