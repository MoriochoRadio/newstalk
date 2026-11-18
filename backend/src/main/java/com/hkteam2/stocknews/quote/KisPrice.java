package com.hkteam2.stocknews.quote;

import java.math.BigDecimal;

/**
 * 종목 현재가 한 번 조회한 결과 (KIS 주식현재가 시세 inquire-price 의 필요한 칸)
 * changeSign: KIS 전일 대비 부호 코드 그대로 (1 상한, 2 상승, 3 보합, 4 하한, 5 하락). 화면용 변환은 나중에
 * marketCap: 시가총액(억 원, KIS hts_avls), sector: 거래소 업종 이름(KIS bstp_kor_isnm, 예 "전기·전자") — 2026-11-16 실제 응답으로 확인
 */
public record KisPrice(
        String stockCode,
        long price,
        long changeAmount,
        String changeSign,
        BigDecimal changeRate,
        long accVolume,
        long open,
        long high,
        long low,
        long marketCap,
        String sector
) {
}
