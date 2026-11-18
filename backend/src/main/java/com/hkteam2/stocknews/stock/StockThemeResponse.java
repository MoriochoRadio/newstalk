package com.hkteam2.stocknews.stock;

/**
 * 테마 하나 (분류별 보기 고르기용, 2026-11-18)
 * stockCount: 이 테마에 묶인 종목 수, articleCount: 기간 안 이 테마 종목이 하나라도 나온 뉴스 기사 수 (공시 제외, 같은 기사는 한 번)
 */
public record StockThemeResponse(String theme, long stockCount, long articleCount) {
}
