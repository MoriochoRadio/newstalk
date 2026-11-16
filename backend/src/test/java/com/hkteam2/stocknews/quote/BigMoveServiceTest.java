package com.hkteam2.stocknews.quote;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import com.hkteam2.stocknews.support.ApiTestSupport;

/**
 * 급등·급락 이력 (F-17): 가짜 일봉 + 테스트 글로 "그날 연결된 글"이 제대로 붙는지 (SQL 포함)
 * KIS 대신 일봉을 직접 넘김 (build). 테스트 트랜잭션이라 넣은 글은 끝나면 되돌려짐
 */
class BigMoveServiceTest extends ApiTestSupport {

    private static final LocalDate TODAY = LocalDate.of(2026, 11, 3);

    @Autowired
    BigMoveService service;

    static KisCandle day(LocalDate date, long close) {
        return new KisCandle(date.atStartOfDay(), close, close, close, close, 5000);
    }

    @Test
    void 급등락한_날에_그날_글을_관련도_순으로_붙이고_최신_날짜부터() {
        LocalDate up = LocalDate.of(2026, 10, 14), down = LocalDate.of(2026, 10, 29);
        List<KisCandle> candles = List.of(
                day(up.minusDays(1), 100000), day(up, 108000),       // +8%
                day(down.minusDays(1), 108000), day(down, 100440),   // -7%
                day(TODAY, 101000));

        long a1 = insertArticle("수주 소식", "NEWS", "DONE", up.atTime(10, 0));
        long a2 = insertArticle("수주 반응", "SNS", "DONE", up.atTime(11, 0));
        long a3 = insertArticle("다른 날 글", "NEWS", "DONE", up.minusDays(1).atTime(23, 59));
        long a4 = insertArticle("분석 전 글", "NEWS", "SUMMARIZED", up.atTime(12, 0));
        link(a1, KIA, 0.65);
        link(a2, KIA, 0.9);
        link(a3, KIA, 0.9);
        link(a4, KIA, 0.9);

        BigMoveResponse r = service.build(KIA, candles, BigMovePeriod.ONE_YEAR, 5, TODAY);

        assertThat(r.items()).extracting(BigMoveResponse.Day::date).containsExactly(down, up);
        BigMoveResponse.Day d = r.items().get(0);
        assertThat(d.direction()).isEqualTo("DOWN");
        assertThat(d.changeRate()).isEqualByComparingTo("-7.00");
        assertThat(d.articleCount()).isZero();

        BigMoveResponse.Day u = r.items().get(1);
        assertThat(u.direction()).isEqualTo("UP");
        assertThat(u.articleCount()).isEqualTo(2);   // 전날 글·DONE 아닌 글은 빠짐
        assertThat(u.articles()).extracting(BigMoveResponse.Article::title).containsExactly("수주 반응", "수주 소식");
        assertThat(u.articles().get(0).relevance()).isEqualTo(90);
    }

    @Test
    void 같은_소식이_많은_기사부터_같은_소식은_하나만_주가_기사는_표시() {
        LocalDate up = LocalDate.of(2026, 10, 14);
        List<KisCandle> candles = List.of(day(up.minusDays(1), 100000), day(up, 108000), day(TODAY, 108000));
        long g1 = insertArticle("특징주 기아 8% 급등", "NEWS", "DONE", up.atTime(10, 0));
        long g2 = insertArticle("기아 8%대 급등…신고가", "NEWS", "DONE", up.atTime(10, 10));
        long g3 = insertArticle("기아, 장중 8% 올라", "NEWS", "DONE", up.atTime(10, 20));
        long solo = insertArticle("기아 미국 공장 증설 발표", "NEWS", "DONE", up.atTime(9, 0));
        long other = insertArticle("기아 노조 임단협", "NEWS", "DONE", up.atTime(8, 0));
        link(g1, KIA, 0.7);
        link(g2, KIA, 0.8);
        link(g3, KIA, 0.6);
        link(solo, KIA, 0.95);
        link(other, KIA, 0.5);
        // g1~g3 = 같은 소식 3건 (묶음 대표 g1)
        jdbc.update("UPDATE article_stock SET group_article_id = ? WHERE article_id IN (?, ?, ?) AND stock_code = ?", g1, g1, g2, g3, KIA);

        BigMoveResponse.Day d = service.build(KIA, candles, BigMovePeriod.ONE_YEAR, 5, TODAY).items().get(0);

        // 같은 소식 3건 묶음이 먼저(그 안에서는 관련도 높은 g2 하나만), 그다음 관련도 순
        assertThat(d.articles()).extracting(BigMoveResponse.Article::title)
                .containsExactly("기아 8%대 급등…신고가", "기아 미국 공장 증설 발표", "기아 노조 임단협");
        assertThat(d.articles()).extracting(BigMoveResponse.Article::priceMoveTitle).containsExactly(true, false, false);
        assertThat(d.articleCount()).isEqualTo(5);
    }

    @Test
    void 기간_밖의_날과_기준_미만은_빠지고_글은_하루_3개까지() {
        LocalDate old = TODAY.minusMonths(4), recent = TODAY.minusDays(5);
        List<KisCandle> candles = List.of(
                day(old.minusDays(1), 10000), day(old, 12000),          // +20%, 3개월 밖
                day(recent.minusDays(1), 12000), day(recent, 12720));   // +6% (그 사이는 0%)
        for (int i = 0; i < 4; i++) {
            link(insertArticle("글" + i, "NEWS", "DONE", recent.atTime(9, i)), KIA, "POSITIVE", null, false);
        }

        BigMoveResponse r = service.build(KIA, candles, BigMovePeriod.THREE_MONTHS, 5, TODAY);
        assertThat(r.from()).isEqualTo(TODAY.minusMonths(3));
        assertThat(r.items()).hasSize(1);
        assertThat(r.items().get(0).articleCount()).isEqualTo(4);
        assertThat(r.items().get(0).articles()).hasSize(3)
                .extracting(BigMoveResponse.Article::title).containsExactly("글3", "글2", "글1");   // 관련도 없으면 최신 순
        assertThat(r.items().get(0).articles().get(0).relevance()).isNull();

        assertThat(service.build(KIA, candles, BigMovePeriod.ONE_YEAR, 25, TODAY).items()).isEmpty();
    }
}
