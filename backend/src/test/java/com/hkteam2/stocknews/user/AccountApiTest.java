package com.hkteam2.stocknews.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import com.hkteam2.stocknews.support.ApiTestSupport;

/** 내 계정: 비밀번호 바꾸기·확인 질문·탈퇴·비밀번호/아이디 찾기 (2026-11-18) */
class AccountApiTest extends ApiTestSupport {

    private static final String JSON = MediaType.APPLICATION_JSON_VALUE;

    private void setRecovery(String token, String question, String answer) throws Exception {
        mvc.perform(put("/api/auth/me/recovery").header("Authorization", bearer(token)).contentType(JSON)
                        .content("{\"password\":\"" + PASSWORD + "\",\"question\":\"" + question
                                + "\",\"answer\":\"" + answer + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.recoveryQuestion.code").value(question));
    }

    @Test
    void 확인_질문_목록이_있다() throws Exception {
        mvc.perform(get("/api/auth/recovery/questions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].code").value("FIRST_SCHOOL"))
                .andExpect(jsonPath("$[0].text").exists());
    }

    @Test
    void 내_정보에_확인_질문과_가입_시각이_나오고_답_원문은_DB에_없다() throws Exception {
        String token = tokenOf("zzacc01");
        mvc.perform(get("/api/auth/me").header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.recoveryQuestion").doesNotExist())
                .andExpect(jsonPath("$.createdAt").exists());

        setRecovery(token, "FIRST_PET", "초코");

        String stored = jdbc.queryForObject("SELECT recovery_answer_hmac FROM users WHERE login_id = 'zzacc01'", String.class);
        assertThat(stored).hasSize(64).doesNotContain("초코");
    }

    @Test
    void 비밀번호를_바꾸면_새_비밀번호로만_로그인된다() throws Exception {
        String token = tokenOf("zzacc02");
        mvc.perform(put("/api/auth/me/password").header("Authorization", bearer(token)).contentType(JSON)
                        .content("{\"currentPassword\":\"wrongpass1\",\"newPassword\":\"newpassword1\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("WRONG_PASSWORD"));
        mvc.perform(put("/api/auth/me/password").header("Authorization", bearer(token)).contentType(JSON)
                        .content("{\"currentPassword\":\"" + PASSWORD + "\",\"newPassword\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("SAME_PASSWORD"));
        mvc.perform(put("/api/auth/me/password").header("Authorization", bearer(token)).contentType(JSON)
                        .content("{\"currentPassword\":\"" + PASSWORD + "\",\"newPassword\":\"newpassword1\"}"))
                .andExpect(status().isNoContent());

        mvc.perform(post("/api/auth/login").contentType(JSON).content(loginJson("zzacc02", PASSWORD)))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/login").contentType(JSON).content(loginJson("zzacc02", "newpassword1")))
                .andExpect(status().isOk());
    }

    @Test
    void 확인_질문_답이_맞으면_비밀번호를_새로_정한다_띄어쓰기_대소문자는_가리지_않음() throws Exception {
        String token = tokenOf("zzacc03");
        setRecovery(token, "BIRTH_CITY", "Seoul 마포");

        mvc.perform(post("/api/auth/recovery/question").contentType(JSON).content("{\"loginId\":\"zzacc03\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("BIRTH_CITY"));
        mvc.perform(post("/api/auth/recovery/reset").contentType(JSON)
                        .content("{\"loginId\":\"zzacc03\",\"answer\":\"부산\",\"newPassword\":\"resetpass1\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("RECOVERY_ANSWER_MISMATCH"));
        mvc.perform(post("/api/auth/recovery/reset").contentType(JSON)
                        .content("{\"loginId\":\"zzacc03\",\"answer\":\"seoul마포\",\"newPassword\":\"resetpass1\"}"))
                .andExpect(status().isNoContent());

        mvc.perform(post("/api/auth/login").contentType(JSON).content(loginJson("zzacc03", "resetpass1")))
                .andExpect(status().isOk());
    }

    @Test
    void 질문을_안_정한_아이디와_없는_아이디는_같은_404() throws Exception {
        tokenOf("zzacc04");
        mvc.perform(post("/api/auth/recovery/question").contentType(JSON).content("{\"loginId\":\"zzacc04\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RECOVERY_NOT_SET"));
        mvc.perform(post("/api/auth/recovery/question").contentType(JSON).content("{\"loginId\":\"zznobody77\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RECOVERY_NOT_SET"));
    }

    @Test
    void 답을_다섯_번_틀리면_맞는_답도_429() throws Exception {
        String token = tokenOf("zzacc05");
        setRecovery(token, "FIRST_PET", "초코");
        String wrong = "{\"loginId\":\"zzacc05\",\"answer\":\"보리\",\"newPassword\":\"resetpass1\"}";
        for (int i = 0; i < 5; i++) {
            mvc.perform(post("/api/auth/recovery/reset").contentType(JSON).content(wrong));
        }
        mvc.perform(post("/api/auth/recovery/reset").contentType(JSON)
                        .content("{\"loginId\":\"zzacc05\",\"answer\":\"초코\",\"newPassword\":\"resetpass1\"}"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("TOO_MANY_ATTEMPTS"));
    }

    @Test
    void 아이디_찾기는_질문_답_비밀번호가_모두_맞아야_한다() throws Exception {
        String token = tokenOf("zzacc06");
        setRecovery(token, "FAVORITE_TEACHER", "김선생");

        mvc.perform(post("/api/auth/recovery/find-id").contentType(JSON)
                        .content("{\"question\":\"FAVORITE_TEACHER\",\"answer\":\"김선생\",\"password\":\"wrongpass1\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ACCOUNT_NOT_FOUND"));
        mvc.perform(post("/api/auth/recovery/find-id").contentType(JSON)
                        .content("{\"question\":\"FAVORITE_TEACHER\",\"answer\":\"김 선생\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.loginId").value("zzacc06"));
    }

    @Test
    void 가입할_때_확인_질문을_같이_정할_수_있고_하나만_주면_400() throws Exception {
        mvc.perform(post("/api/auth/signup").contentType(JSON)
                        .content("{\"loginId\":\"zzacc07\",\"password\":\"" + PASSWORD + "\",\"recoveryQuestion\":\"FIRST_PET\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/auth/signup").contentType(JSON)
                        .content("{\"loginId\":\"zzacc07\",\"password\":\"" + PASSWORD
                                + "\",\"recoveryQuestion\":\"FIRST_PET\",\"recoveryAnswer\":\"초코\"}"))
                .andExpect(status().isCreated());
        mvc.perform(post("/api/auth/recovery/question").contentType(JSON).content("{\"loginId\":\"zzacc07\"}"))
                .andExpect(jsonPath("$.code").value("FIRST_PET"));
    }

    @Test
    void 탈퇴하면_관심_종목_글_댓글_공감까지_지워지고_그_토큰은_401() throws Exception {
        String token = tokenOf("zzacc08");
        String other = tokenOf("zzacc09");
        mvc.perform(post("/api/watchlist").header("Authorization", bearer(token)).contentType(JSON)
                .content("{\"stockCode\":\"" + KIA + "\"}")).andExpect(status().isCreated());
        long myPost = readLong(mvc.perform(post("/api/stocks/" + KIA + "/posts").header("Authorization", bearer(token))
                .contentType(JSON).content("{\"title\":\"내 글\",\"content\":\"내용\"}")).andReturn(), "$.postId");
        long otherPost = readLong(mvc.perform(post("/api/stocks/" + KIA + "/posts").header("Authorization", bearer(other))
                .contentType(JSON).content("{\"title\":\"남의 글\",\"content\":\"내용\"}")).andReturn(), "$.postId");
        mvc.perform(post("/api/posts/" + otherPost + "/comments").header("Authorization", bearer(token))
                .contentType(JSON).content("{\"content\":\"내 댓글\"}"));
        mvc.perform(post("/api/posts/" + otherPost + "/like").header("Authorization", bearer(token)));
        mvc.perform(post("/api/posts/" + myPost + "/comments").header("Authorization", bearer(other))
                .contentType(JSON).content("{\"content\":\"남이 내 글에 단 댓글\"}"));

        mvc.perform(delete("/api/auth/me").header("Authorization", bearer(token)).contentType(JSON)
                        .content("{\"password\":\"wrongpass1\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("WRONG_PASSWORD"));
        mvc.perform(delete("/api/auth/me").header("Authorization", bearer(token)).contentType(JSON)
                        .content("{\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isNoContent());

        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM users WHERE login_id = 'zzacc08'", Long.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM board_post WHERE post_id = ?", Long.class, myPost)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM board_post WHERE post_id = ?", Long.class, otherPost)).isOne();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM board_comment WHERE post_id = ?", Long.class, otherPost)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM board_like WHERE post_id = ?", Long.class, otherPost)).isZero();
        mvc.perform(get("/api/auth/me").header("Authorization", bearer(token)))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/login").contentType(JSON).content(loginJson("zzacc08", PASSWORD)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void 로그인_없이_내_계정_API는_401() throws Exception {
        mvc.perform(put("/api/auth/me/password").contentType(JSON)
                        .content("{\"currentPassword\":\"" + PASSWORD + "\",\"newPassword\":\"newpassword1\"}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(delete("/api/auth/me").contentType(JSON).content("{\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isUnauthorized());
    }
}
