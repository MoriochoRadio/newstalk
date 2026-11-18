package com.hkteam2.stocknews.user;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 계정 관리 요청들 (2026-11-18). 규칙에 어긋나면 400 INVALID_REQUEST */
public final class AccountRequests {

    private AccountRequests() {
    }

    /** 비밀번호 바꾸기 (로그인한 채로) */
    public record ChangePassword(
            @NotBlank(message = "지금 비밀번호를 입력해 주세요.") String currentPassword,
            @NotBlank(message = "새 비밀번호를 입력해 주세요.")
            @Size(min = 8, max = 64, message = "비밀번호는 8~64자입니다.") String newPassword) {
    }

    /** 확인 질문 정하기·바꾸기 (로그인한 채로. 남이 몰래 바꾸지 못하게 비밀번호도 받음) */
    public record SetRecovery(
            @NotBlank(message = "비밀번호를 입력해 주세요.") String password,
            @Schema(example = "FIRST_PET") @NotBlank(message = "질문을 골라 주세요.") String question,
            @NotBlank(message = "답을 입력해 주세요.") @Size(max = 50, message = "답은 50자 이하입니다.") String answer) {
    }

    /** 탈퇴 (비밀번호로 한 번 더 확인) */
    public record DeleteAccount(@NotBlank(message = "비밀번호를 입력해 주세요.") String password) {
    }

    /** 비밀번호 찾기 1단계: 이 아이디의 질문 보기 */
    public record AskQuestion(@NotBlank(message = "아이디를 입력해 주세요.") @Size(max = 30) String loginId) {
    }

    /** 비밀번호 찾기 2단계: 답이 맞으면 새 비밀번호로 */
    public record ResetPassword(
            @NotBlank(message = "아이디를 입력해 주세요.") @Size(max = 30) String loginId,
            @NotBlank(message = "답을 입력해 주세요.") @Size(max = 50) String answer,
            @NotBlank(message = "새 비밀번호를 입력해 주세요.")
            @Size(min = 8, max = 64, message = "비밀번호는 8~64자입니다.") String newPassword) {
    }

    /** 아이디 찾기: 질문·답 + 비밀번호가 모두 맞는 계정 (답만으로 찾으면 같은 답을 쓴 남의 아이디가 보일 수 있음) */
    public record FindLoginId(
            @Schema(example = "FIRST_PET") @NotBlank(message = "질문을 골라 주세요.") String question,
            @NotBlank(message = "답을 입력해 주세요.") @Size(max = 50) String answer,
            @NotBlank(message = "비밀번호를 입력해 주세요.") @Size(max = 64) String password) {
    }
}
