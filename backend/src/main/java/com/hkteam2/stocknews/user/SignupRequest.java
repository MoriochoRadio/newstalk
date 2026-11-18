package com.hkteam2.stocknews.user;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** 회원가입 요청. 규칙에 어긋나면 Controller에 들어오기 전에 400으로 거절. 확인 질문은 선택(둘 다 주거나 둘 다 비움) */
public record SignupRequest(
        @Schema(description = "아이디 (영문 소문자·숫자 4~20자)", example = "tester01")
        @NotBlank(message = "아이디를 입력해 주세요.")
        @Pattern(regexp = "^[a-z0-9]{4,20}$", message = "아이디는 영문 소문자와 숫자 4~20자입니다.")
        String loginId,

        @Schema(description = "비밀번호 (8~64자)", example = "password123")
        @NotBlank(message = "비밀번호를 입력해 주세요.")
        @Size(min = 8, max = 64, message = "비밀번호는 8~64자입니다.")
        String password,

        @Schema(description = "(선택) 계정 찾기 확인 질문 코드. GET /api/auth/recovery/questions", example = "FIRST_PET")
        String recoveryQuestion,

        @Schema(description = "(선택) 확인 질문의 답 (1~50자, 띄어쓰기·영문 대소문자는 가리지 않음)", example = "초코")
        @Size(max = 50, message = "답은 50자 이하입니다.")
        String recoveryAnswer
) {

    /** 아이디·비밀번호만 보낼 때 (테스트 등) */
    public SignupRequest(String loginId, String password) {
        this(loginId, password, null, null);
    }
}
