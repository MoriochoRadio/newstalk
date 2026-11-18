package com.hkteam2.stocknews.user;

/** 계정 관리 응답들 (2026-11-18) */
public final class AccountResponses {

    private AccountResponses() {
    }

    /** 확인 질문 하나 (code 를 저장, text 는 화면에 보일 말) */
    public record Question(String code, String text) {
        static Question of(RecoveryQuestion q) {
            return new Question(q.name(), q.getText());
        }
    }

    /** 아이디 찾기 결과 */
    public record FoundLoginId(String loginId) {
    }
}
