"""요약 단계 규칙 시험. OpenAI 를 부르지 않음"""
from unittest import mock


def test_step5_check():
    from hk_llm.steps.step5_summary import ArticleSummary, Company, _strip_tag, check

    # check() 는 OpenAI 없이 시험 (비용 0)
    def co(name, role="SUBJECT", reason="r"):
        return Company(name=name, evidence=0, role=role, fact_type="FACT", sentiment="POSITIVE", reason=reason)

    fake = ArticleSummary(summary="요약", sentiment="NEUTRAL", keywords=["a" * 80] * 7, companies=[
        co("샘표", reason="r" * 300), co("지어낸회사", role="PARTY", reason="기사에 없음")])
    got = check(fake, "샘표·샘표식품 합병", "본문")
    assert [c.name for c in got.companies] == ["샘표"], "기사에 없는 회사는 빠져야 함"
    assert len(got.companies[0].reason) == 200 and len(got.keywords) == 5 and len(got.keywords[0]) == 50
    many = ArticleSummary(summary="요약", sentiment="NEUTRAL", keywords=[], companies=[co(f"회사{i}", "LISTED") for i in range(13)] + [co("샘표")])
    got = check(many, "샘표", " ".join(f"회사{i}" for i in range(13)))
    assert got.companies[0].name == "샘표" and len(got.companies) == 12, "연결하는 역할을 앞에 두고 12개까지"
    for evil in ("</article>", "< / ARTICLE >", "&lt;/article&gt;", "</article​>"):
        assert "<" not in _strip_tag(evil) and ">" not in _strip_tag(evil), evil
    try:
        check(ArticleSummary(summary="2024년 4분기부터 공급한다", sentiment="NEUTRAL", keywords=[], companies=[]),
              "제목", "올해 4·4분기부터 2027년 말까지 공급")
        raise AssertionError("기사에 없는 연도는 거부해야 함")
    except ValueError:
        pass
    check(ArticleSummary(summary="2027년 말까지 공급한다", sentiment="NEUTRAL", keywords=[], companies=[]), "제목", "2027년 말까지")
    # LLM 은 관련종목 줄을 뺀 앞 3,000자를 봄 → 그 범위 안 숫자는 원문 3,000자 밖이어도 통과 (11/17)
    tag = "관련종목 삼성전자(005930)\n" * 200
    check(ArticleSummary(summary="매출 4,321억원", sentiment="NEUTRAL", keywords=[], companies=[]), "제목", tag + "매출 4,321억원")


def test_step5_answer_checks():
    """11/11: 요약 숫자 검사 (하루 요약과 같은 규칙), 감성 이유가 주가 움직임뿐이면 NEUTRAL (프롬프트 규칙을 LLM 이 어긴 것)"""
    from hk_llm.steps.step5_summary import ArticleSummary, Company, check, price_only

    def ask(summary="요약", sentiment="POSITIVE", reason="r"):
        return ArticleSummary(summary=summary, sentiment="NEUTRAL", keywords=[], companies=[
            Company(name="삼성전자", evidence=0, role="SUBJECT", fact_type="FACT", sentiment=sentiment, reason=reason)])

    body = "삼성전자는 3분기 영업이익 9조4천억원을 냈다. 주가는 20만1000원으로 5.85% 올랐다."
    assert check(ask("영업이익 9.4조원, 주가 5.85% 상승"), "삼성전자", body).summary, "단위가 달라도 같은 값이면 통과"
    try:
        check(ask("영업이익 12조원"), "삼성전자", body)
        raise AssertionError("기사에 없는 숫자는 거부해야 함")
    except ValueError:
        pass

    # 실제 답(11/11 검토 ①): 이유가 주가 움직임뿐 → NEUTRAL, 원인 사실이 있으면 그대로
    for reason in ("전 거래일 대비 주가가 8.71% 상승해 주가 레벨이 회복됐다.", "프리마켓에서 12.97% 하락하며 주가가 크게 내려갔기 때문이다.",
                   "장중 주가가 17만9200원까지 내려가 11% 이상 급락해 하락 충격이 제시됐다.", "상장 첫날 공모가 대비 105.88% 급등했다."):
        assert price_only(reason), reason
        assert check(ask(reason=reason), "삼성전자", body).companies[0].sentiment == "NEUTRAL", reason
    for reason in ("3분기 영업이익이 컨센서스 대비 35% 하회해 실적 부진이 주가 급락으로 연결됐다.", "80% 무상감자 단행 소식 이후 주가가 큰 폭으로 하락했다.",
                   "반도체 수출이 큰 폭으로 늘며 주가가 5%대 상승했다.", "주가가 공개매수 소식에 9.71% 상승했다.", "수주 계약 당사자다"):
        assert not price_only(reason), reason
    assert check(ask(sentiment="NEGATIVE", reason="수주 계약이 해지됐다"), "삼성전자", body).companies[0].sentiment == "NEGATIVE"
    # 원인이 전망·우려뿐이면 중립이 아니라 판단 보류 (프롬프트 [감성] UNCERTAIN), 제도 시행은 사실이라 그대로
    got = check(ask(sentiment="NEGATIVE", reason="기술료 수입 감소 우려가 제기된 가운데 주가가 16.01% 하락해 거래를 마쳤다."), "삼성전자", body)
    assert got.companies[0].sentiment == "UNCERTAIN"
    assert not price_only("저PBR 기업 공표 제도 시행 첫날 11.61% 상승하며 강세를 보였다.")
    # 11/19 PR #131 검토 반례: 원인(판매·가격·지급·부양·수혜)이 있는 이유를 주가 움직임뿐으로 잘못 봤던 것
    for reason in ("주가 부양책을 내놓았다.", "판매량이 20% 상승했다.", "D램 가격 10% 상승으로 수혜가 예상된다.",
                   "주당 1,000원을 지급한다.", "금값 상승세로 수혜를 봤다."):
        assert not price_only(reason), reason

    # 공시 요약은 숫자 검사를 안 함: 표 머리 단위("단위: 백만원")를 붙여 쓴 맞는 요약을 거부했음 (11/11 실제 공시 3/10)
    from hk_llm.steps import dart
    fake = dart.DisclosureSummary(summary="3분기 매출액 24,529백만원, 영업손실 2,854백만원.", evidence="", sentiment="NEGATIVE", reason="적자전환")
    with mock.patch.object(dart, "llm_call", return_value=fake):
        assert dart.summarize_one("영업(잠정)실적", "(단위 : 백만원) 매출액 당해실적 24,529 영업이익 당해실적 -2,854").summary
    # 공시 감성도 판단 보류가 있고 DB 에는 NULL (11/11, 라벨 기준 v2.1)
    assert dart.final_sentiment("영업(잠정)실적", "UNCERTAIN") is None
    assert dart.final_sentiment("영업(잠정)실적", "NEGATIVE") == "NEGATIVE"


def test_step8_numbers():
    from hk_llm.steps.step8_daily import unknown_numbers

    assert unknown_numbers("영업이익 1,200억원, 3분기 12% 증가", "- 영업이익 1200억원, 12% 증가") == []
    assert unknown_numbers("영업이익 1,500억원", "- 영업이익 1200억원") == ["1,500억"]
    assert unknown_numbers("3분기 실적", "- 실적") == [], "한 자리 수는 안 봄"
    # 2026-11-10 지승현 지적: 글자 포함 비교라 자료 숫자 안에 들어 있는 다른 숫자가 통과하던 것
    assert unknown_numbers("수주 50억", "- 수주 1,500억") == ["50억"]
    assert unknown_numbers("12% 증가", "- 3.12% 증가") == ["12"]
    assert unknown_numbers("30만 명", "- 130만 명") == ["30만"]
    # 한글 단위로 쓴 맞는 숫자는 통과 (경계만 맞추면 거절되던 것)
    assert unknown_numbers("영업이익 9천400억원", "- 영업이익 9천400억원") == []
    assert unknown_numbers("영업이익 9천400억원", "- 영업이익 9400억원") == []
    assert unknown_numbers("매출 1조2천억원", "- 매출 1.2조원") == [], "1.2조 = 1조2천억 (예전엔 걸렸음)"
    assert unknown_numbers("매출 1조 2천억원", "- 매출 1조2000억원") == []
    assert unknown_numbers("5조 투자", "- 3조 투자") == ["5조"], "한 자리여도 큰 단위가 붙으면 봄"


def test_step8_rejected_keeps_summary():
    from hk_llm.steps import step8_daily as s8

    rows = [{"stock_name": "삼성전자", "is_main": True, "summary": "요약", "reason": "이유", "sentiment": "POSITIVE"}]
    engine = mock.MagicMock()
    conn = engine.begin.return_value.__enter__.return_value
    with mock.patch.object(s8, "combine", side_effect=s8.RejectedAnswer("기사에 없는 숫자")):
        assert s8._save_stock(engine, "005930", rows, "2026-11-04") == ""
    params = conn.execute.call_args.args[1]
    sql = str(conn.execute.call_args.args[0])
    assert "news_summary" not in sql and "generated_at" not in sql, "기존 요약·시각을 안 건드림"
    assert params["pos"] == 1, "기사 수는 저장해서 LLM 을 또 안 부름"


def test_step8_rules():
    from hk_llm.steps.step8_daily import _line, combine, counts

    from unittest import mock

    main = {"is_main": 1, "summary": "삼성전자가  실적을\n냈다.", "reason": "이유", "sentiment": "POSITIVE"}
    side = {"is_main": 0, "summary": "현대차 투자 기사다.", "reason": "브랜드 가치가 올랐다. (장기: 호재)", "sentiment": "NEUTRAL"}
    assert _line(main) == "삼성전자가 실적을 냈다."
    assert _line(side) == "브랜드 가치가 올랐다.", "조연은 다른 종목 요약을 쓰지 않음"
    assert counts([main, side]) == {"pos": 1, "neg": 0, "neu": 1}
    with mock.patch("hk_llm.steps.step8_daily.ChatOpenAI", side_effect=AssertionError("1건이면 LLM 안 부름")):
        assert combine("삼성전자", ["삼성전자가 한 줄을 냈다."]) == "삼성전자가 한 줄을 냈다."
    # 그 줄에 종목 이름이 없으면 주어를 밝히게 LLM 에 맡김 (11/16 밤: SK스퀘어 요약 주어가 SK하이닉스)
    fake = mock.MagicMock()
    with mock.patch("hk_llm.steps.step8_daily.llm_call", return_value="삼성전자는 한 줄을 냈다.") as called:
        assert combine("삼성전자", ["한 줄이다."], llm=fake) == "삼성전자는 한 줄을 냈다."
        assert called.called, "이름 없는 1줄은 LLM 을 부름"

def test_step8_skips_unchanged_even_with_unjudged_links():
    """11/17: 판단 보류 연결(감성 NULL)이 있는 종목은 저장된 감성 수와 기사 수가 늘 달라 매시간 다시 만들었음"""
    from datetime import date, datetime
    from unittest import mock

    from hk_llm.steps import step8_daily as s8

    s8._LAST.clear()
    t = datetime(2026, 11, 17, 10, 0)
    rows = [{"stock_code": "005930", "stock_name": "삼성전자", "is_main": 1, "summary": "삼성전자 요약.", "reason": "r",
             "sentiment": "POSITIVE", "created_at": t},
            {"stock_code": "005930", "stock_name": "삼성전자", "is_main": 1, "summary": "전망 기사.", "reason": "r",
             "sentiment": None, "created_at": t}]
    engine = mock.MagicMock()
    conn = engine.connect.return_value.__enter__.return_value
    conn.execute.return_value = [("005930", 1)]   # 저장된 감성 수 = 1 (NULL 은 안 셈)
    day = date(2026, 11, 17)
    with mock.patch.object(s8, "load_rows", return_value=rows), mock.patch.object(s8, "_save_stock") as save:
        assert s8.summarize_day(engine, day)[2] == 1, "재시작 직후: 감성 있는 연결 수가 같으면 그대로"
        assert s8.summarize_day(engine, day)[2] == 1, "다음 시간: 기사가 그대로면 그대로"
        assert not save.called
        rows.append({**rows[1], "created_at": datetime(2026, 11, 17, 11, 0)})   # 판단 보류 기사가 새로 옴
        assert s8.summarize_day(engine, day)[0] == 1, "감성 수는 같아도 새 기사가 오면 다시 만듦"
        assert s8.summarize_day(engine, day)[2] == 1
        assert save.call_count == 1
    s8._LAST.clear()


def test_step8_single_mention_needs_no_llm():
    """함께 언급된 기사 1건뿐이면 LLM 없이 그 기사 요약 첫 문장 (이유 한 줄로 지어내던 것)"""
    from unittest import mock

    from hk_llm.steps import step8_daily as s8

    row = {"stock_code": "035420", "stock_name": "NAVER", "is_main": 0, "sentiment": "NEUTRAL",
           "summary": "A사가 NAVER에 서버를 공급한다. 계약 규모는 100억원이다.", "reason": "공급계약의 상대방이다."}
    engine = mock.MagicMock()
    conn = engine.begin.return_value.__enter__.return_value
    with mock.patch.object(s8, "llm_call", side_effect=AssertionError("LLM 을 부르면 안 됨")):
        assert s8._save_stock(engine, "035420", [row], "2026-11-17") == "함께 언급된 기사: A사가 NAVER에 서버를 공급한다."
    assert conn.execute.call_args.args[1]["text"].startswith("함께 언급된 기사")

def test_step8_etf_holding_needs_product_name():
    """11/17: ETF 편입 소식이 '삼성전자는 … 신규 편입됐고 편입 비중을 … 확대했다' 로 회사가 한 일처럼 나옴 → 한 번 다시, 그래도면 거부"""
    from unittest import mock

    from hk_llm.steps import step8_daily as s8

    news = ["한투운용은 ACE 글로벌반도체TOP4 Plus ETF 리밸런싱에서 삼성전자 편입 비중을 3.43%에서 19.75%로 올렸다.",
            "삼성전자는 엑시노스 탑재를 늘린다."]
    bad = "삼성전자는 엑시노스 탑재를 늘린다. 또한 편입 비중을 3.43%에서 19.75%로 크게 확대했다."
    good = "삼성전자는 엑시노스 탑재를 늘린다. ACE 글로벌반도체TOP4 Plus ETF 가 삼성전자 편입 비중을 3.43%에서 19.75%로 늘렸다."
    assert s8.missing_product(bad, "\n".join(news)) and not s8.missing_product(good, "\n".join(news))
    assert not s8.missing_product("삼성전자는 매출 비중이 늘었다.", "- 매출 비중이 늘었다"), "ETF 소식이 없으면 안 봄"
    with mock.patch.object(s8, "llm_call", side_effect=[bad, good]) as called:
        assert s8.combine("삼성전자", news, llm=mock.MagicMock()) == good
        assert called.call_count == 2, "한 번 다시 물음"
    with mock.patch.object(s8, "llm_call", side_effect=[bad, bad]):
        try:
            s8.combine("삼성전자", news, llm=mock.MagicMock())
            raise AssertionError("거부해야 함")
        except s8.RejectedAnswer:
            pass


def test_dart_unjudged_is_null():
    """요약 전 공시는 판단을 안 한 것 → 감성 NULL (중립 = "판단했더니 영향 없음", 11/11: 공시 연결 7,096개 중 6,329개가 요약 없이 NEUTRAL)"""
    from datetime import datetime

    from sqlalchemy import create_engine, text
    from sqlalchemy.pool import StaticPool

    from hk_llm.core.config import KST
    from hk_llm.steps import dart

    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    with engine.begin() as c:
        c.execute(text("CREATE TABLE stock_info (stock_code)"))
        c.execute(text("INSERT INTO stock_info VALUES ('005930')"))
        c.execute(text("""CREATE TABLE article (article_id INTEGER PRIMARY KEY, url_key, url, press, title, description, published_at, status,
                          summary, sentiment, source_type, channel, collect_mode, model, retry_count, last_error)"""))
        c.execute(text("CREATE TABLE article_stock (article_id, stock_code, is_main, sentiment, reason, match_type, relevance, matched_keywords)"))
    row = {"rcept_no": "20261111000001", "stock_code": "005930", "corp_name": "삼성전자", "report_nm": "주식소각결정", "rcept_dt": "20261111"}
    assert dart.save_disclosures(engine, [row], datetime(2026, 11, 11, 10, tzinfo=KST)) == 1
    read = text("SELECT a.sentiment, s.sentiment FROM article a JOIN article_stock s USING (article_id) ORDER BY a.article_id")
    with engine.connect() as c:
        assert c.execute(read).all() == [(None, None)], "요약 전에는 판단 안 함"

    # 지난 줄 정리: 요약 안 된 공시만 NULL 로. AI 가 판단한 중립과 뉴스는 그대로
    with engine.begin() as c:
        c.execute(text("""INSERT INTO article (article_id, channel, model, sentiment) VALUES
                          (2, 'DART', NULL, 'NEUTRAL'), (3, 'DART', 'm', 'NEUTRAL'), (4, 'RSS', NULL, 'NEUTRAL')"""))
        c.execute(text("INSERT INTO article_stock (article_id, sentiment) VALUES (2, 'NEUTRAL'), (3, 'NEUTRAL'), (4, 'NEUTRAL')"))
    assert dart.clear_unjudged(engine) == 1
    assert dart.clear_unjudged(engine) == 0, "다시 돌려도 안전"
    with engine.connect() as c:
        assert c.execute(text("SELECT sentiment FROM article WHERE article_id > 1 ORDER BY article_id")).scalars().all() == [None, "NEUTRAL", "NEUTRAL"]
        assert c.execute(text("SELECT sentiment FROM article_stock WHERE article_id > 1 ORDER BY article_id")).scalars().all() == [None, "NEUTRAL", "NEUTRAL"]

    # 11/17: 공시는 전부 저장, LLM 요약은 주요 공시만 (일반 공시는 retry_count = MAX_TRIES 로 요약 대상에서 빠짐)
    routine = dict(row, rcept_no="20261111000002", report_nm="임원ㆍ주요주주특정증권등소유상황보고서")
    assert dart.save_disclosures(engine, [routine], datetime(2026, 11, 11, 10, tzinfo=KST)) == 1
    with engine.connect() as c:
        tries = c.execute(text("SELECT retry_count FROM article ORDER BY article_id")).scalars().all()
    assert tries == [0, None, None, None, dart.MAX_TRIES], tries


def _summary_rows(n):
    from types import SimpleNamespace
    return [SimpleNamespace(article_id=i, title=f"제목{i}", body="본문", retry_count=0) for i in range(n)]


def _summary_engine(rows):
    engine = mock.MagicMock()
    engine.connect.return_value.__enter__.return_value.execute.return_value.all.return_value = rows
    return engine


def test_step5_summarizes_in_parallel():
    """11/18: 요약을 4개씩 동시에. 8건 × 0.2초 → 4개씩이면 약 0.4초 (한 건씩이면 1.6초)"""
    import threading
    import time
    from hk_llm.steps import step5_summary as s5
    from hk_llm.steps import step6_match

    running = peak = 0
    lock = threading.Lock()

    def slow(title, body, model):
        nonlocal running, peak
        with lock:
            running += 1
            peak = max(peak, running)
        time.sleep(0.2)
        with lock:
            running -= 1
        return object(), {}

    saved = []
    with mock.patch.object(step6_match, "load_dictionary", return_value=([], None, None)), \
            mock.patch.object(step6_match, "could_link", side_effect=lambda t, b, n: t != "제목7"), \
            mock.patch.object(s5, "summarize", side_effect=slow), \
            mock.patch.object(s5, "_save", side_effect=lambda e, aid, s, m: saved.append(aid)), \
            mock.patch.object(s5, "title_only_presses", return_value=["x"]):
        started = time.monotonic()
        done = s5.summarize_articles(_summary_engine(_summary_rows(9)))
        took = time.monotonic() - started
    assert done == 8 and sorted(saved) == [0, 1, 2, 3, 4, 5, 6, 8], "거른 글(7)만 빼고 모두 저장"
    assert peak == s5.WORKERS == 4, peak
    assert took < 1.0, f"동시에 처리하면 1초 안 ({took:.2f}초)"


def test_step5_parallel_stops_on_budget_and_openai_errors():
    """하루 상한이면 남은 글을 건너뛰고 조용히 끝냄, OpenAI 쪽 문제면 남은 글을 건너뛰고 예외를 다시 던짐 (예전과 같은 뜻)"""
    import httpx
    import openai
    from hk_llm.steps import step5_summary as s5
    from hk_llm.steps import step6_match

    def run(error, n=20):
        calls = []

        def fake(title, body, model):
            calls.append(title)
            if len(calls) == 2:
                raise error
            return object(), {}

        with mock.patch.object(step6_match, "load_dictionary", return_value=([], None, None)), \
                mock.patch.object(step6_match, "could_link", return_value=True), \
                mock.patch.object(s5, "summarize", side_effect=fake), \
                mock.patch.object(s5, "_save"), \
                mock.patch.object(s5, "title_only_presses", return_value=["x"]):
            return s5.summarize_articles(_summary_engine(_summary_rows(n))), calls

    done, calls = run(s5.BudgetExceeded("상한"))
    assert len(calls) < 20 and done == len(calls) - 1, (done, len(calls))
    try:
        run(openai.APIConnectionError(request=httpx.Request("POST", "https://api.openai.com")))
        raise AssertionError("OpenAI 쪽 문제는 실행을 멈추게 다시 던져야 함")
    except openai.APIConnectionError:
        pass
