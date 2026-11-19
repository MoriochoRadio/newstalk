package com.hkteam2.stocknews.user;

import java.util.Arrays;
import java.util.Optional;

/**
 * 계정 찾기 확인 질문 (2026-11-18). 자유 질문은 '1+1은?'처럼 누구나 맞히는 질문을 막을 수 없어 정해진 목록에서 고름.
 * 답이 남에게 잘 알려지지 않고, 시간이 지나도 바뀌지 않는 것만 (NIST SP 800-63B 는 확인 질문을 인증 수단으로 권하지 않음 →
 * 여기서는 '잊었을 때 되찾기' 용도로만, 시도 횟수를 제한해서 씀)
 * 11/19: FIRST_PHONE(휴대폰 번호 뒷자리 네 개) 뺌 — 답이 숫자 4자리(1만 가지)라 맞혀 보기 쉬움 (보안 검토).
 *        이미 이 질문을 정한 계정은 '질문 안 정함'으로 보이고, 내 정보 화면에서 다시 정하면 됨
 */
public enum RecoveryQuestion {
    FIRST_SCHOOL("처음 다닌 초등학교 이름은?"),
    CHILDHOOD_FRIEND("어릴 때 가장 친했던 친구 이름은?"),
    FIRST_PET("처음 키운 반려동물 이름은?"),
    BIRTH_CITY("태어난 도시(동네) 이름은?"),
    FAVORITE_TEACHER("기억에 남는 선생님 성함은?");

    private final String text;

    RecoveryQuestion(String text) {
        this.text = text;
    }

    public String getText() {
        return text;
    }

    /** 코드 → 질문. 없는 코드면 empty */
    public static Optional<RecoveryQuestion> of(String code) {
        return Arrays.stream(values()).filter(q -> q.name().equals(code)).findFirst();
    }
}
