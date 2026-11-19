package com.hkteam2.stocknews.stock;

import java.time.LocalDate;
import java.util.List;

/**
 * 이슈 종목 순위 응답: 목록 공통 형식(items, totalCount)에 date 를 더함
 * date = 순위를 센 날. 보통 오늘, 오늘 글이 없으면 글이 있는 가장 최근 날 (화면은 "11/10 기준"처럼 표시)
 */
public record StockIssuesResponse(LocalDate date, List<StockIssueResponse> items, long totalCount) {
}
