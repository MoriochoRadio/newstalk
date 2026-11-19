package com.hkteam2.stocknews.feedback;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.hkteam2.stocknews.common.config.OpenApiConfig;
import com.hkteam2.stocknews.common.security.CurrentUser;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

/** "연결이 틀렸어요" (2026-11-13). 로그인 필요 (SecurityConfig AUTHENTICATED_POST_PATHS) — 아무나 쌓지 못하게 */
@Tag(name = "연결 의견", description = "사용자가 틀린 기사-종목 연결을 알려 줌. AI 가 정답지 후보·매칭 규칙 점검에 씀")
@SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
@RestController
public class LinkFeedbackController {

    private final LinkFeedbackService service;

    public LinkFeedbackController(LinkFeedbackService service) {
        this.service = service;
    }

    @Operation(summary = "연결이 틀렸어요",
            description = "kind: WRONG_STOCK(이 종목 이야기가 아님) / WRONG_SENTIMENT(기사 내용 판단이 틀림)."
                    + " 이 기사에 이 종목 연결이 없으면 404 LINK_NOT_FOUND. 같은 의견을 다시 보내도 204 (1건만 남음)")
    @PostMapping("/api/articles/{articleId}/stocks/{stockCode}/feedback")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void report(@AuthenticationPrincipal Jwt jwt, @PathVariable long articleId, @PathVariable String stockCode,
                       @Valid @RequestBody LinkFeedbackRequest request) {
        service.report(CurrentUser.id(jwt), articleId, stockCode, request.kind());
    }
}
