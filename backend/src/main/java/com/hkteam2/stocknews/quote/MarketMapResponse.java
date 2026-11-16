package com.hkteam2.stocknews.quote;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * 종목 지도(시가총액 지도) 재료 (GET /api/quotes/market-map, 2026-11-16)
 * 코스피·코스닥 시가총액 상위 각 30개(우선주 뺌). marketCap 은 억 원, sector 는 거래소 업종 이름(전기·전자 등, 못 받으면 "기타")
 * changeRate 는 전일 대비 %, 하락이면 음수. priceLimit 는 상한가 UPPER·하한가 LOWER·아니면 null
 */
public record MarketMapResponse(List<Item> items, OffsetDateTime fetchedAt) {

    public record Item(String stockCode, String stockName, String market, String sector, long marketCap,
                       long price, BigDecimal changeRate, String priceLimit) {
    }
}
