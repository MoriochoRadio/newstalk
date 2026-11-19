package com.hkteam2.stocknews.stock;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;

import com.hkteam2.stocknews.common.TimeUtils;

/**
 * 오늘의 이슈 종목 한 줄. avgRelevance는 화면용 %(0~100), 없으면 null
 * articleCount = 뉴스 기사 수(보도량, 순위 기준), eventCount = 같은 소식을 1건으로 센 뉴스 소식 수 (예: 글 7건 · 소식 3건)
 * positiveCount·negativeCount = 그 종목에 대해 긍정·부정으로 판단된 뉴스 수 (이슈 맵 색, 2026-11-17)
 * disclosureCount = 오늘 공시 수 (순위 점수에는 안 들어감, 화면 배지용. 2026-11-10)
 */
public record StockIssueResponse(
        int rank,
        String stockCode,
        String stockName,
        long articleCount,
        long eventCount,
        long disclosureCount,
        long positiveCount,
        long negativeCount,
        Integer avgRelevance,
        OffsetDateTime lastPublishedAt
) {

    public static StockIssueResponse of(int rank, StockIssueRow row) {
        return new StockIssueResponse(rank, row.stockCode(), row.stockName(), row.articleCount(), row.eventCount(), row.disclosureCount(),
                row.positiveCount(), row.negativeCount(),
                toPercent(row.avgRelevance()), TimeUtils.toKst(row.lastPublishedAt()));
    }

    /** 평균이라 소수가 길 수 있음: 0.825 -> 83 (반올림) */
    private static Integer toPercent(BigDecimal relevance) {
        return relevance == null ? null
                : relevance.movePointRight(2).setScale(0, RoundingMode.HALF_UP).intValue();
    }
}
