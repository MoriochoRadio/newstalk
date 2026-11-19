package com.hkteam2.stocknews.feedback;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/** "연결이 틀렸어요" 요청. 회원 ID는 받지 않음 (토큰에서 꺼냄) */
public record LinkFeedbackRequest(
        @Schema(description = "WRONG_STOCK(이 종목 이야기가 아님) 또는 WRONG_SENTIMENT(기사 내용 판단이 틀림)", example = "WRONG_STOCK")
        @NotBlank(message = "무엇이 틀렸는지 골라 주세요.")
        @Pattern(regexp = "^(WRONG_STOCK|WRONG_SENTIMENT)$", message = "WRONG_STOCK 또는 WRONG_SENTIMENT 입니다.")
        String kind
) {
}
