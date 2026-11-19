package com.hkteam2.stocknews.feedback;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

import com.hkteam2.stocknews.support.ApiTestSupport;

/** "연결이 틀렸어요" (POST /api/articles/{id}/stocks/{code}/feedback). 로그인 필요 */
class LinkFeedbackApiTest extends ApiTestSupport {

    private ResultActions report(String token, long articleId, String code, String kind) throws Exception {
        var req = post("/api/articles/" + articleId + "/stocks/" + code + "/feedback")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"kind\":\"" + kind + "\"}");
        return mvc.perform(token == null ? req : req.header("Authorization", bearer(token)));
    }

    private int count(long articleId) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM link_feedback WHERE article_id = ?", Integer.class, articleId);
    }

    @Test
    void 로그인하면_저장되고_같은_의견은_한_번만() throws Exception {
        long id = insertArticle("기아 기사", "NEWS", "DONE", today(1));
        link(id, KIA, 0.9);
        String token = tokenOf("zzfeed01");

        report(token, id, KIA, "WRONG_STOCK").andExpect(status().isNoContent());
        report(token, id, KIA, "WRONG_STOCK").andExpect(status().isNoContent());
        report(token, id, KIA, "WRONG_SENTIMENT").andExpect(status().isNoContent());
        assertThat(count(id)).isEqualTo(2);
    }

    @Test
    void 토큰이_없으면_401() throws Exception {
        long id = insertArticle("기아 기사", "NEWS", "DONE", today(1));
        link(id, KIA, 0.9);
        report(null, id, KIA, "WRONG_STOCK").andExpect(status().isUnauthorized());
        assertThat(count(id)).isZero();
    }

    @Test
    void 연결되지_않은_종목이면_404_종류가_틀리면_400() throws Exception {
        long id = insertArticle("기아 기사", "NEWS", "DONE", today(1));
        link(id, KIA, 0.9);
        String token = tokenOf("zzfeed02");

        report(token, id, NAVER, "WRONG_STOCK").andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("LINK_NOT_FOUND"));
        report(token, id, KIA, "DELETE_ALL").andExpect(status().isBadRequest());
        assertThat(count(id)).isZero();
    }
}
