package com.hkteam2.stocknews.user;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.text.Normalizer;
import java.util.HexFormat;
import java.util.Locale;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * 확인 질문 답 → HMAC-SHA256 (16진수 64자). 원문은 저장하지 않음.
 * - 다듬기: 한글 조합 통일(NFC), 띄어쓰기 지움, 영문 소문자 → '서울 초등학교' = '서울초등학교', 'Mimi' = 'mimi'
 * - 열쇠: app.jwt.secret 에서 "recovery-answer" 라는 이름으로 한 번 더 HMAC 해 갈라 만듦 (새 환경변수 없이, 토큰 서명 열쇠와는 다른 값)
 *   주의: app.jwt.secret 을 바꾸면 저장된 답과 맞지 않게 됨 → 그때는 회원이 질문을 다시 정해야 함
 * - 질문 코드도 같이 넣음: 질문이 다르면 같은 답이어도 다른 값
 */
@Component
public class RecoveryAnswerHasher {

    private static final String ALGORITHM = "HmacSHA256";

    private final byte[] key;

    public RecoveryAnswerHasher(@Value("${app.jwt.secret}") String jwtSecret) {
        this.key = hmac(jwtSecret.getBytes(StandardCharsets.UTF_8), "recovery-answer");
    }

    public String hash(RecoveryQuestion question, String answer) {
        return HexFormat.of().formatHex(hmac(key, question.name() + ":" + normalize(answer)));
    }

    /** 저장된 값과 같은지 (걸린 시간으로 몇 글자가 맞았는지 알 수 없게 비교) */
    public boolean matches(RecoveryQuestion question, String answer, String storedHex) {
        if (storedHex == null) {
            return false;
        }
        return MessageDigest.isEqual(hash(question, answer).getBytes(StandardCharsets.US_ASCII),
                storedHex.getBytes(StandardCharsets.US_ASCII));
    }

    static String normalize(String answer) {
        String s = Normalizer.normalize(answer == null ? "" : answer, Normalizer.Form.NFC);
        return s.replaceAll("\s+", "").toLowerCase(Locale.ROOT);
    }

    private static byte[] hmac(byte[] key, String message) {
        try {
            Mac mac = Mac.getInstance(ALGORITHM);
            mac.init(new SecretKeySpec(key, ALGORITHM));
            return mac.doFinal(message.getBytes(StandardCharsets.UTF_8));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("HMAC-SHA256 을 쓸 수 없음", e);
        }
    }
}
