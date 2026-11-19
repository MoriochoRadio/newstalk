"""7단계 (17번): 같은 사건을 다룬 비슷한 기사 묶기 → article_stock.group_article_id

    from hk_llm.steps.step7_group import group_articles, save_groups
    groups = group_articles(rows)   # rows: article_id, stock_code, stock_name, title, summary(없어도 됨), published_at
    save_groups()                   # 최근 기사를 묶어 저장. 칸이 아직 없으면 아무것도 안 함 (팀공유 6번)

묶는 조건: 같은 종목 + 비슷한 제목·요약 + 가까운 시각. 기사를 버리지 않는다.
유사도: 제목+AI 요약에서 괄호·기호·공백과 종목명을 뺀 뒤 글자 2개씩 자른 조각의 겹침 비율 (Jaccard)
  - 한쪽만 요약이 있으면(제목만 언론사·요약 전) 위 비교에 더해 제목끼리도 봄, 기준 0.10 (11/11: 제목+요약 대 제목만은 글자 수가 달라
    점수가 낮아져 같은 소식을 놓쳤음. 팀 데이터 섞인 쌍 1,430개에서 113쌍을 더 묶고 지금 묶음은 그대로. 표본 12쌍 중 1쌍은 다른 회사 실적)
  - 2026-11-10: 제목만 → 제목+요약, 기준 0.10 → 0.09. 같은 종목·24시간 후보 쌍 119개(점수 가린 판정 + 사람 확인 30쌍,
    판정 기준 v2)에서 정밀도 84.7 → 89.3%, 재현율 72.2 → 81.7% (구간 가중). 5겹 교차 검증 F1 73.9 → 79.7%.
    표본이 작아 부트스트랩 구간은 0 을 포함 → 둘 다 좋아지고 비용 0 이라 채택, 쌓이면 다시 잼 (백엔드1 로컬 기록 ai-improve/20)
"""
import re
from datetime import datetime, timedelta

from sqlalchemy import bindparam, text

from hk_llm.core.config import KST
from hk_llm.core.db import get_engine, to_db
from hk_llm.core.util import get_logger

log = get_logger(__name__)

SIMILAR = 0.09  # 제목+요약 겹침 기준 (위 설명). 틀려도 기사는 안 지워짐
TITLE_SIMILAR = 0.10  # 한쪽만 요약이 있을 때 제목끼리 겹침 기준 (11/09 측정에서 제목만일 때 가장 좋았던 값)
WINDOW = timedelta(hours=24)
RECENT = timedelta(hours=72)  # ponytail: 최근 72시간만 다시 묶음. 더 오래된 묶음은 그대로 둠, 사슬이 3일을 넘는 사건은 나뉠 수 있음


def _bigrams(title, stock_name=""):
    t = re.sub(r"\[[^\]]*\]|\([^)]*\)", "", title)
    t = re.sub(r"[^0-9A-Za-z가-힣]", "", t.replace(stock_name, "")).upper()
    return {t[i:i + 2] for i in range(len(t) - 1)}


def similarity(a, b, stock_name=""):
    x, y = _bigrams(a, stock_name), _bigrams(b, stock_name)
    return len(x & y) / len(x | y) if x and y else 0.0


def _text(row):
    """비교할 글: 제목 + AI 요약 (요약이 없으면 제목만)"""
    return f"{row['title']} {row.get('summary') or ''}".strip()


def same_news(a, b, similar=SIMILAR):
    """제목+요약이 겹치면 같은 소식. 한쪽만 요약이 있으면 제목끼리 겹쳐도 같은 소식"""
    name = a["stock_name"]
    if similarity(_text(a), _text(b), name) >= similar:
        return True
    return bool(a.get("summary")) != bool(b.get("summary")) and similarity(a["title"], b["title"], name) >= TITLE_SIMILAR


def group_articles(rows, similar=SIMILAR, window=WINDOW):
    """[{stock_code, stock_name, article_ids}] — 2건 이상인 묶음만. 한 기사가 여러 종목 묶음에 들어갈 수 있음"""
    by_stock = {}
    for r in rows:
        by_stock.setdefault(r["stock_code"], []).append(r)
    groups = []
    for code, items in by_stock.items():
        parent = {r["article_id"]: r["article_id"] for r in items}

        def find(x):
            while parent[x] != x:
                parent[x] = parent[parent[x]]
                x = parent[x]
            return x

        for i, a in enumerate(items):  # ponytail: 종목 안에서 모든 쌍 비교. 하루치 기준이라 충분, 많아지면 시각순으로 자르기
            for b in items[i + 1:]:
                near = abs(a["published_at"] - b["published_at"]) <= window
                if near and same_news(a, b, similar):
                    parent[find(a["article_id"])] = find(b["article_id"])
        found = {}
        for r in items:
            found.setdefault(find(r["article_id"]), []).append(r["article_id"])
        groups += [{"stock_code": code, "stock_name": items[0]["stock_name"], "article_ids": sorted(ids)}
                   for ids in found.values() if len(ids) > 1]
    return groups


def load_rows(engine, since=None):
    sql = text("""SELECT a.article_id, s.stock_code, i.stock_name, a.title, a.summary, a.published_at
                  FROM article a JOIN article_stock s USING (article_id) JOIN stock_info i USING (stock_code)
                  WHERE a.status = 'DONE' AND a.channel IN ('RSS', 'SITEMAP') AND (:since IS NULL OR a.published_at >= :since)""")
    with engine.connect() as conn:
        return [dict(r._mapping) for r in conn.execute(sql, {"since": since})]


def has_column(engine):
    sql = text("""SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE()
                  AND table_name = 'article_stock' AND column_name = 'group_article_id'""")
    with engine.connect() as conn:
        return bool(conn.execute(sql).scalar())


def save_groups(engine=None, everything=False):
    """저장한 묶음 수. 대표 기사 = 묶음에서 가장 먼저 저장된 기사. 칸이 없으면 0
    everything=True: 기간 제한 없이 전체를 다시 묶음 (python -m hk_llm.steps.step7_group --all).
    평소(5분마다)는 최근 72시간만 보므로, 칸(V13, 11/09)이 생기기 전 기사는 한 번도 묶이지 않았음
    → 지난 날짜의 "같은 소식 n건"·eventCount 가 빠짐 (2026-11-10 지승현 검토: 11/02~06 연결 912개 중 묶음 0). 한 번 돌리면 채워짐"""
    engine = engine or get_engine()
    if not has_column(engine):
        log.info("group_article_id 칸이 아직 없어 기사 묶음 저장을 건너뜀")
        return 0
    rows = load_rows(engine, None if everything else to_db(datetime.now(KST) - RECENT))
    if not rows:
        return 0
    groups = group_articles(rows)
    clear = text("UPDATE article_stock SET group_article_id = NULL WHERE article_id IN :ids"
                 ).bindparams(bindparam("ids", expanding=True))
    put = text("UPDATE article_stock SET group_article_id = :rep WHERE stock_code = :code AND article_id IN :ids"
               ).bindparams(bindparam("ids", expanding=True))
    with engine.begin() as conn:  # 지우고 넣기를 한 번에 → 화면이 빈 묶음을 보지 않음
        conn.execute(clear, {"ids": sorted({r["article_id"] for r in rows})})
        for g in groups:
            conn.execute(put, {"rep": g["article_ids"][0], "code": g["stock_code"], "ids": g["article_ids"]})
    log.info("기사 묶음 저장: %d개", len(groups))
    return len(groups)


if __name__ == "__main__":
    import sys

    if "--all" in sys.argv:  # 전체 기간 다시 묶어 저장 (LLM 비용 없음, DB 켜져 있어야 함)
        print("묶음", save_groups(everything=True), "개 저장")
        sys.exit()
    # 실제 샘플 (읽기만, DB 켜져 있어야 함)
    rows = load_rows(get_engine())
    title = {r["article_id"]: r["title"] for r in rows}
    found = group_articles(rows)
    print(f"실제 샘플: 연결 {len(rows)}줄, 묶음 {len(found)}개")
    for g in found:
        print(" ", g["stock_name"], [(i, title[i][:30]) for i in g["article_ids"]])
    assert any(set(g["article_ids"]) >= {9, 1097} for g in found), "영광 상장 첫날 두 기사는 묶여야 함"
    print("ok")
