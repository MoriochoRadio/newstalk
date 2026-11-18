package com.hkteam2.stocknews.stock;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.hkteam2.stocknews.support.ApiTestSupport;

/** 분류별 보기: 시장(KOSPI·KOSDAQ)·테마로 글 목록·이슈 순위 거르기, 테마 목록 (2026-11-18) */
class StockCategoryApiTest extends ApiTestSupport {

    /** 코스닥 종목 (알테오젠) */
    private static final String KOSDAQ_STOCK = "196170";
    private static final String THEME = "zz테스트테마";

    private long kiaArticle;
    private long kosdaqArticle;

    @BeforeEach
    void setUp() {
        jdbc.update("INSERT INTO stock_theme (stock_code, theme) VALUES (?, ?)", KIA, THEME);
        kiaArticle = insertArticle("기아 신차", "NEWS", "DONE", today(1));
        kosdaqArticle = insertArticle("알테오젠 기술 수출", "NEWS", "DONE", today(2));
        link(kiaArticle, KIA, 0.9);
        link(kosdaqArticle, KOSDAQ_STOCK, 0.9);
    }

    @Test
    void 시장을_고르면_그_시장_종목이_나온_글만() throws Exception {
        mvc.perform(get("/api/articles").param("market", "kosdaq"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalCount").value(1))
                .andExpect(jsonPath("$.items[0].articleId").value(kosdaqArticle));
        mvc.perform(get("/api/articles").param("market", "KOSPI"))
                .andExpect(jsonPath("$.items[*].articleId").value(hasItem((int) kiaArticle)))
                .andExpect(jsonPath("$.items[*].articleId").value(not(hasItem((int) kosdaqArticle))));
    }

    @Test
    void 테마를_고르면_그_테마_종목이_나온_글만() throws Exception {
        mvc.perform(get("/api/articles").param("theme", THEME))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalCount").value(1))
                .andExpect(jsonPath("$.items[0].articleId").value(kiaArticle));
        mvc.perform(get("/api/articles").param("theme", "없는테마"))
                .andExpect(jsonPath("$.totalCount").value(0));
    }

    @Test
    void 이슈_순위도_시장_테마로_거르고_순위는_1부터() throws Exception {
        mvc.perform(get("/api/stocks/issues").param("market", "KOSDAQ"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].stockCode").value(KOSDAQ_STOCK))
                .andExpect(jsonPath("$.items[0].rank").value(1));
        mvc.perform(get("/api/stocks/issues").param("theme", THEME))
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].stockCode").value(KIA));
    }

    @Test
    void 테마_목록은_기사_수와_종목_수를_준다() throws Exception {
        mvc.perform(get("/api/stocks/themes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[?(@.theme == '" + THEME + "')].articleCount").value(hasItem(1)))
                .andExpect(jsonPath("$.items[?(@.theme == '" + THEME + "')].stockCount").value(hasItem(1)));
    }

    @Test
    void 없는_시장_값은_400() throws Exception {
        mvc.perform(get("/api/articles").param("market", "NASDAQ"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
        mvc.perform(get("/api/stocks/issues").param("market", "NASDAQ"))
                .andExpect(status().isBadRequest());
    }
}
