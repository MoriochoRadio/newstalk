package com.hkteam2.stocknews.stock;

import java.util.Locale;
import java.util.Set;

import com.hkteam2.stocknews.common.error.BusinessException;
import com.hkteam2.stocknews.common.error.ErrorCode;

/**
 * 분류별 보기 조건 검사 (2026-11-18): 시장(KOSPI·KOSDAQ)과 테마(stock_theme 이름).
 * 업종(KIND 업종명)은 158개에 '전동기, 발전기 및 전기 변환 · 공급 · 제어 장치 제조업'처럼 길어서 고르기 어려움
 * → 화면의 '업종·테마' 는 우리가 정리한 테마 37개(반도체·바이오·증권·방산 …)로 고름
 */
public final class StockCategory {

    private static final Set<String> MARKETS = Set.of("KOSPI", "KOSDAQ");
    private static final int MAX_THEME_LENGTH = 50;   // stock_theme.theme VARCHAR(50)

    private StockCategory() {
    }

    /** null·빈 값이면 null(안 거름). KOSPI·KOSDAQ 이 아니면 400 */
    public static String market(String market) {
        if (market == null || market.isBlank()) {
            return null;
        }
        String m = market.trim().toUpperCase(Locale.ROOT);
        if (!MARKETS.contains(m)) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST);
        }
        return m;
    }

    /** null·빈 값이면 null(안 거름). 50자를 넘으면 400. 없는 테마는 그대로 넘겨 0건 */
    public static String theme(String theme) {
        if (theme == null || theme.isBlank()) {
            return null;
        }
        String t = theme.trim();
        if (t.length() > MAX_THEME_LENGTH) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST);
        }
        return t;
    }
}
