package com.hkteam2.stocknews.user;

import java.time.OffsetDateTime;

import com.hkteam2.stocknews.common.TimeUtils;

/**
 * 현재 로그인한 회원 정보. 2026-11-18부터 토큰 내용이 아니라 DB 에서 읽음 (탈퇴한 계정의 토큰이면 401)
 * recoveryQuestion: 정한 확인 질문 (안 정했으면 null)
 * createdAt: 가입 시각, watchlistCount·postCount·commentCount: 관심 종목·쓴 글·쓴 댓글 수 (내 정보 화면용)
 */
public record MeResponse(Long userId, String loginId, String role, AccountResponses.Question recoveryQuestion,
                         OffsetDateTime createdAt, int watchlistCount, int postCount, int commentCount) {

    static MeResponse from(User user, int watchlistCount, int postCount, int commentCount) {
        AccountResponses.Question q = RecoveryQuestion.of(user.getRecoveryQuestion())
                .map(AccountResponses.Question::of).orElse(null);
        return new MeResponse(user.getUserId(), user.getLoginId(), user.getRole(), q,
                user.getCreatedAt() == null ? null : TimeUtils.toKst(user.getCreatedAt()),
                watchlistCount, postCount, commentCount);
    }
}
