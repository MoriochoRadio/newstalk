-- 사용자가 알려 준 "연결이 틀렸어요" (2026-11-13)
-- 쓰는 곳: 백엔드 POST /api/articles/{id}/stocks/{code}/feedback (로그인), AI eval/feedback.py 가 읽어 정답지 후보·매칭 규칙 점검에 씀
-- article_stock 이 아니라 (article_id, stock_code) 를 저장: AI 가 다시 연결하면 article_stock 줄이 지워졌다 다시 생겨도 기록이 남게
-- 한 사람이 같은 연결·같은 종류를 여러 번 눌러도 1건 (UNIQUE)
CREATE TABLE link_feedback (
    feedback_id BIGINT      NOT NULL AUTO_INCREMENT,
    article_id  BIGINT      NOT NULL COMMENT '기사 ID',
    stock_code  CHAR(6)     NOT NULL COMMENT '틀렸다는 연결의 종목',
    user_id     BIGINT      NOT NULL COMMENT '알려 준 회원',
    kind        VARCHAR(20) NOT NULL COMMENT 'WRONG_STOCK(이 종목 이야기가 아님) / WRONG_SENTIMENT(기사 내용 판단이 틀림)',
    created_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (feedback_id),
    UNIQUE KEY uq_link_feedback (article_id, stock_code, user_id, kind),
    KEY idx_link_feedback_created (created_at),
    CONSTRAINT fk_link_feedback_article FOREIGN KEY (article_id) REFERENCES article (article_id) ON DELETE CASCADE,
    CONSTRAINT fk_link_feedback_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    CONSTRAINT ck_link_feedback_kind CHECK (kind IN ('WRONG_STOCK', 'WRONG_SENTIMENT'))
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '사용자가 알려 준 틀린 연결';
