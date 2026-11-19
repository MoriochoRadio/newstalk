# ai

뉴스·공시 수집 및 LLM 요약 파이프라인 (`loop.py` 로 자동 실행, `api.py` 는 "다시 생성" 서버)

- 역할: 뉴스·공시 수집, 정제·중복 제거, 기사-종목 연결, LLM 요약, 매칭 정확도 측정
- 기술: Python, LangChain, FastAPI (백엔드와는 DB 로 주고받고, "다시 생성" 만 API)

## 팀원이 먼저 볼 것

| 문서 | 내용 |
|---|---|
| [docs/팀공유.md](docs/팀공유.md) | AI 쪽에서 정한 것, 화면용 기사 데이터 예시 |
| [docs/AI테이블_제안.md](docs/AI테이블_제안.md) | 처음 드린 AI 테이블 제안. 지금 기준은 레포 `docs/db/schema.md` |
| [docs/결정사항.md](docs/결정사항.md) | 지금 기준 AI 설계 한눈에 보기 |

## 지금 상태 (2026-11-10)

- 담당: 뉴스 수집·종목 매칭·요약 개선과 백엔드 통합은 백엔드1, SNS 수집은 지승현 (`docs/decisions.md` 2026-11-03)
- 연결 정확도 (2026-11-06, 정답지 v2.1 **개발용** 99건, 주인공·당사자 연결 기준): Precision 92.2~92.3%, Recall 87~89%, 맞은 연결의 감성 일치 60~71% (같은 설정으로 3번 돌린 범위, `ai/eval/regress.py`). 정답지는 LLM 라벨 + 사람 2명 확인 ([라벨_기준_v2.md](docs/평가/라벨_기준_v2.md) 8절). 개발용은 규칙을 고칠 때 본 기사라 후할 수 있음 → **봉인 시험 100건은 발표 전 1번 채점** (`python -m eval.regress --llm --split test`)
- 예전 기준(11/03, 정답지 v1 100건, LLM 심판): Precision 90.2%, Recall 85.6%

- 끝: RSS 수집(15) → 중복 제거(16) → DB 저장(18) → 본문(20~22) → LLM 요약(27~34) → 종목 매칭(23·25), 공시 수집·요약, 종목별 하루 요약(32), 자동 실행 코드(35), AI 서버 ([docs/개발순서.md](docs/개발순서.md))
- SNS: 네이버 카페·블로그 최소 구현 ([docs/조사/SNS_조사.md](docs/조사/SNS_조사.md), PR #53) → **1차에서 뺌 (2026-11-09), `SNS_ENABLED=false` 기본**. 측정: 카페는 작성 날짜가 오지 않고 거르면 3%, 블로그는 42% 가 같은 소식을 뉴스보다 8시간 늦게 다시 쓴 글·감성의 주가 일치율도 뉴스와 같음, 기사 댓글·커뮤니티는 robots.txt 가 막음. 코드는 남아 있지만 **버리기로 함** (2026-11-10, 정리는 [docs/할일.md](docs/할일.md))
- 다음: [docs/할일.md](docs/할일.md) (2026-11-10 다시 시작: 버그 수정·근거 요약 다시 쓰기, 화면까지 E2E(36)). 남은 한계는 [docs/한계와_실험.md](docs/한계와_실험.md)
- 뉴스: **언론사 11곳 RSS 16개** (본문 요약: 한경·파이낸셜·전자신문·비즈워치·블로터·시사저널e·인사이트코리아·헤럴드경제 / 제목만: 연합·서경·연합인포맥스. 방침은 `hk_llm/core/press_policy.py`, 2026-11-16 기준). 주기 5분, **자동 실행은 켜야 돎** (`python -m hk_llm.loop`)
- 흐름: RSS 목록 → 중복 제거 → (AI 활용 금지 언론사 3곳은 본문·LLM 없이 제목만으로 종목 연결) → 원문 본문 → LLM 요약 → 요약에서 종목 연결 + 주제 확인 → 공시 요약 → 기사 묶기, 1시간마다 하루 요약 (SNS 는 꺼 둠)
- 단계끼리는 `article.status` 로 넘김: `LISTED` → `FETCHED` → `SUMMARIZED` → `DONE` / `NO_STOCK`
- 백엔드와는 **DB 로** 주고받음 (AI 가 쓰고 백엔드가 읽음), "다시 생성" 만 API. 테이블은 백엔드 Flyway V5·V7·V12~V15 (레포 `docs/db/schema.md`)
- 실행마다 수집 점검 (공백·피드 연속 실패·멈춘 기사·수집량 급감·글자 깨짐), `SLACK_WEBHOOK_URL` 이 있으면 Slack 알림 (새로 생긴·사라진 문제만)
- 화면에는 **요약 + 원문 링크만** (본문은 7일 후 삭제, 언론사 AI 정책)
- 연결됨: 비슷한 기사 묶음 저장(17, V13 `group_article_id`, 2026-11-09), 프론트 V7 화면 실제 API 연결(2026-11-10, 레포 `docs/v1-prototype.md`), 백엔드 "다시 생성" (PR #49)
- 공시: DART 주요 공시 원문을 LLM 으로 요약·감성 판단. 실패하면 제목·감성 NULL(판단 안 함)로 남음
- 🧪 팀 공유 필요: 매칭 점수(이름 통과 + 테마 가산점), 주제 확인 규칙 (공시 표시는 2026-11-10 의무/자율·정정·유형으로 정해짐, 레포 `docs/decisions.md`)
- 보류: 네이버 API(과거 기록용)
- 비용: 호출마다 토큰 기록, 하루 상한 $2 (`LLM_DAILY_USD`, 추정치 기준)

## 폴더

`steps/` 의 번호가 파이프라인 순서.

```
ai/
├── README.md
├── requirements.txt
├── Dockerfile           자동 실행을 Docker 로 (docker-compose 프로필 ai)
├── hk_llm/
│   ├── run.py               ★ 파이프라인 1번 실행 (실행 기록 collect_run)
│   ├── loop.py              ★ 자동 실행: 5분마다 run, 1시간마다 하루 요약 (SNS 는 SNS_ENABLED=true 일 때만) (35번)
│   ├── api.py               AI 서버: "다시 생성" (FastAPI)
│   ├── export_data.py       본문 뺀 수집 결과를 팀 공유용 Flyway 파일로 내보내기 (백엔드1)
│   ├── steps/               단계별 코드. 번호 순서가 흐름 순서
│   │   ├── step1_rss.py     1. 언론사 11곳 RSS 16개 기사 목록 받기 (15번)
│   │   ├── step2_dedup.py   2. 주소 기준 중복 제거 (16번)
│   │   ├── step3_save.py    3. article 에 LISTED 로 저장 (18번)
│   │   ├── step4_body.py    4. 원문 본문 가져와 FETCHED, 7일 지난 본문 삭제 (20~22번)
│   │   ├── step5_summary.py 5. LLM 요약·감성·회사 목록 → SUMMARIZED (27~34번)
│   │   ├── step6_match.py   6. 회사 이름 → 종목 연결 → DONE / NO_STOCK (23·25번)
│   │   ├── step7_group.py   7. 비슷한 기사 묶기 → article_stock.group_article_id (17번, V13)
│   │   ├── step6b_indirect.py 간접 연결 실험. 1차 서비스에 안 넣음, main 에 있음 (백엔드1)
│   │   ├── step8_daily.py   8. 종목별 하루 요약 → stock_daily_summary (32번)
│   │   ├── backfill.py      지난 기사 채우기 (백엔드1)
│   │   ├── dart.py          공시 수집 → 바로 DONE, 원문 LLM 요약·감성
│   │   ├── sns.py           SNS: 네이버 카페·블로그 수집, 거르기, 감성·여론 요약
│   │   ├── title_only.py    AI 활용 금지 언론사: 본문·LLM 없이 제목만으로 종목 연결 (비용 0)
│   │   ├── rights.py        언론사의 AI 이용 거부 표시 자동 확인 → 거부면 제목만(TITLE_ONLY)
│   │   ├── health.py        수집 점검: 공백·피드 연속 실패·멈춘 기사·수집량 급감·글자 깨짐
│   │   └── robots.py        본문 가져오기 전 robots.txt 허용 확인
│   ├── core/                여러 단계가 같이 쓰는 것
│   │   ├── config.py        설정: 폴더 위치, 시간대, .env 값
│   │   ├── db.py            DB 연결, KST 시각 변환
│   │   ├── models.py        기사 한 건의 모양 (Article, article 테이블 한 줄)
│   │   ├── press_policy.py  언론사별 AI 이용 방침 (FULL / TITLE_ONLY / EXCLUDED)
│   │   ├── resilience.py    수집 장애 대비: 재시도 간격·Retry-After·출처별 차단기 ([docs/수집-장애-대응.md](docs/수집-장애-대응.md))
│   │   ├── notify.py        수집 점검 결과를 Slack 으로 (SLACK_WEBHOOK_URL 이 있을 때만)
│   │   └── util.py          로그, 실패 시 재시도
│   ├── data/                (Git 제외) 검토용 샘플
│   └── logs/                (Git 제외) hk_llm.log
├── eval/                    정답지로 종목 연결 정확도 재기 (백엔드1)
├── tests/                   규칙 시험과 DB 시험. 네이버·LLM 은 안 부름
├── old/                     더 이상 안 쓰는 옛 파일 (설명은 old/README.md)
└── docs/                문서 안내는 docs/README.md
```

## 실행

모든 명령은 `ai` 폴더에서 `python -m` 으로 실행한다 (`hk_llm` 패키지를 찾아야 해서).

```bash
cd ai
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

- 키·DB 계정은 레포 최상위 `.env` (`.env.example` 참고, 레포 `docs/setup.md` 2절)
- DB 켜기: 레포 최상위에서 `docker compose up -d db`. 테이블이 없으면 백엔드를 한 번 켬 `docker compose up -d --build backend` (Flyway 가 만듦)

| 하고 싶은 것 | 명령 |
|---|---|
| **자동 실행** (끌 때까지, OpenAI 비용. 처음엔 밀린 기사까지 요약, 금액은 [docs/할일.md](docs/할일.md)) | `python -m hk_llm.loop` |
| AI 서버 (`.env` 에 `AI_INTERNAL_TOKEN`) | `uvicorn hk_llm.api:app --port 8000` |
| 파이프라인 1번 (OpenAI 비용, SNS 는 안 돎) | `python -m hk_llm.run` |
| SNS 1번, 종목 n개 (OpenAI 비용) | `python -m hk_llm.steps.sns 3` |
| 파이프라인 1번, 요약은 n건까지만 (시험용) | `python -m hk_llm.run --limit 30` |
| 요약 n건 미리보기 (저장 안 함, 건당 약 $0.0006) | `python -m hk_llm.steps.step5_summary 3` |
| 규칙 시험 전체 (LLM 비용 없음, DB·인터넷 필요) | `python -m tests` |
| DB·인터넷이 필요한 시험을 빼고 (CI 와 같음) | `python -m tests offline` |
| 자동 실행 + AI 서버를 Docker 로 (레포 최상위에서, OpenAI 비용) | `docker compose --profile ai up -d --build` |
| 오늘까지 쓴 LLM 추정 비용 보기 | DB `llm_usage_daily` (수집기·직접 실행이 같이 셈, 11/13 V16). 실행 로그 끝의 "오늘 LLM 추정 비용 $…". DB 가 안 될 때만 `hk_llm/logs/llm_usage.json` 에 예비 기록 |
| 실제 공시 수집 (비용 없음, DB 저장, `DART_API_KEY` 필요) | `python -m hk_llm.steps.dart` |
| 오늘 종목별 요약 (2건 이상인 종목만 비용) | `python -m hk_llm.steps.step8_daily --run` |
| 1~3단계 시험 | `python -m hk_llm.run --check` |
| RSS 만 받아 보기 | `python -m hk_llm.steps.step1_rss` |
| 쉬고 있는 출처(차단기) 보기·직접 멈춤·다시 열기 ([수집 장애 대응](docs/수집-장애-대응.md)) | `python -m hk_llm.core.resilience` · `… open DART 60 이유` · `… close DART` |
| 언론사별 방침 보기·빼기·되돌리기 | `python -m hk_llm.core.press_policy` · `… exclude 연합뉴스 이유` · `… reset 연합뉴스` |
| 본문 쓰는 언론사의 AI 이용 거부 표시 지금 확인 | `python -m hk_llm.steps.rights` |
| 수집 점검 결과 보기 (비용 없음) | `python -m hk_llm.steps.health` |
| 제목만 연결 규칙을 바꾼 뒤 다시 연결 (비용 없음) | `python -m hk_llm.steps.title_only --redo` |

- 가짜 데이터로 하는 시험은 `tests/`, 각 파일 맨 아래 `if __name__ == "__main__":` 은 실제 기사·API 로 돌리는 부분
- `data/`·`logs/` 는 Git 에 올리지 않는다 (팀 규칙)
