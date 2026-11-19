package com.hkteam2.stocknews.common.config;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.test.context.TestPropertySource;

import com.hkteam2.stocknews.support.ApiTestSupport;

/** API 문서(Swagger)·demo.html 켜고 끄기 (11/19 QA: 실제로 내보낼 때는 API_DOCS_ENABLED=false) */
class ApiDocsSwitchTest {

    @Nested
    class 기본은_켜짐 extends ApiTestSupport {
        @Test
        void 문서와_demo_가_열린다() throws Exception {
            mvc.perform(get("/v3/api-docs")).andExpect(status().isOk());
            mvc.perform(get("/demo.html")).andExpect(status().isOk());
        }
    }

    @Nested
    @TestPropertySource(properties = "API_DOCS_ENABLED=false")
    class 끄면_막힘 extends ApiTestSupport {
        @Test
        void 문서는_404_demo_는_막힌다() throws Exception {
            mvc.perform(get("/v3/api-docs")).andExpect(status().isNotFound());
            mvc.perform(get("/demo.html")).andExpect(status().is4xxClientError());
        }
    }
}
