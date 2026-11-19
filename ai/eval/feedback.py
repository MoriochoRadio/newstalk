"""사용자가 알려 준 "연결이 틀렸어요" 모아 보기 (2026-11-13). LLM 안 씀, DB 읽기만

    python -m eval.feedback            최근 30일, 여러 사람이 알려 준 연결부터
    python -m eval.feedback --days 7

- 쓰는 곳: 정답지 후보 고르기, step6_match 규칙 점검. 사용자 의견은 정답이 아님 → 사람이 기사를 읽고 판단한 뒤에만 정답지·규칙에 반영
- 표: link_feedback (백엔드 V17). WRONG_STOCK = 이 종목 이야기가 아님, WRONG_SENTIMENT = 기사 내용 판단이 틀림
- 지금 연결(article_stock)이 이미 바뀌었으면 "지금 연결 없음" 으로 보임 → 규칙을 고친 뒤 해결됐는지 확인용
"""
import sys
from datetime import datetime, timedelta

from sqlalchemy import text

from hk_llm.core.config import KST
from hk_llm.core.db import get_engine, to_db

SQL = text("""
    SELECT f.article_id, f.stock_code, i.stock_name, f.kind, COUNT(*) AS people, MAX(f.created_at) AS last_at,
           a.title, a.press, s.is_main, s.sentiment, s.reason
    FROM link_feedback f
    JOIN article a ON a.article_id = f.article_id
    LEFT JOIN stock_info i ON i.stock_code = f.stock_code
    LEFT JOIN article_stock s ON s.article_id = f.article_id AND s.stock_code = f.stock_code
    WHERE f.created_at >= :since
    GROUP BY f.article_id, f.stock_code, i.stock_name, f.kind, a.title, a.press, s.is_main, s.sentiment, s.reason
    ORDER BY people DESC, last_at DESC
""")


def collect(engine, days=30):
    since = datetime.now(KST) - timedelta(days=days)
    with engine.connect() as conn:
        return conn.execute(SQL, {"since": to_db(since)}).all()


def show(rows):
    if not rows:
        print("받은 의견 없음")
        return
    kinds = {"WRONG_STOCK": "종목 아님", "WRONG_SENTIMENT": "판단 틀림"}
    for r in rows:
        now = "지금 연결 없음" if r.is_main is None else f"{'주인공' if r.is_main else '함께 언급'} · {r.sentiment or '판단 보류'}"
        print(f"[{r.people}명] {kinds.get(r.kind, r.kind)} | 기사 {r.article_id} {r.press} | {r.stock_name or r.stock_code}({r.stock_code}) | {now}")
        print(f"        제목: {r.title}")
        if r.reason:
            print(f"        연결 이유: {r.reason}")


if __name__ == "__main__":
    days = int(sys.argv[sys.argv.index("--days") + 1]) if "--days" in sys.argv else 30
    show(collect(get_engine(), days))
