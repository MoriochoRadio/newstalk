-- 2026-11-18 계정 찾기용 확인 질문 (이메일·휴대폰을 받지 않는 서비스라 비밀번호·아이디를 잊으면 되찾을 길이 없었음)
-- recovery_question: 고른 질문의 코드 (RecoveryQuestion enum, 예: FIRST_SCHOOL). 안 정했으면 NULL
-- recovery_answer_hmac: 답을 다듬어(공백 제거·소문자) 서버 비밀값으로 HMAC-SHA256 한 값(16진수 64자). 답 원문은 저장하지 않음
--   BCrypt(무작위 소금) 대신 HMAC 인 이유: '아이디 찾기'에서 (질문, 답)이 같은 계정을 DB 에서 찾아야 해서 같은 답 = 같은 값이어야 함.
--   비밀값은 DB 밖(app.jwt.secret 에서 갈라 만듦)이라 DB 만 새어 나가면 답을 맞혀 볼 수 없음 (docs/decisions.md 2026-11-18)
ALTER TABLE users
    ADD COLUMN recovery_question    VARCHAR(30) NULL COMMENT '계정 찾기 확인 질문 코드 (안 정했으면 NULL)' AFTER role,
    ADD COLUMN recovery_answer_hmac CHAR(64)    NULL COMMENT '확인 질문 답의 HMAC-SHA256 (원문 저장 안 함)' AFTER recovery_question,
    ADD KEY idx_users_recovery (recovery_question, recovery_answer_hmac);
