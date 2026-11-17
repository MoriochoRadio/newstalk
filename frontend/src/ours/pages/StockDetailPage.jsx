// 종목 상세: 머리(이름·코드·시장·현재가) → 캔들 차트 → 오늘 AI 요약(다시 만들기) · 감성 비율 · 언급량 → 관련 뉴스(페이지) → 토론
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Sparkles, Star } from 'lucide-react';
import { articleApi, quoteApi, stockApi } from '../../api';
import { toUiArticle } from '../../api/adapters';
import { useApi } from '../../hooks/useApi';
import { useSession } from '../app/session';
import { useQuotes } from '../lib/useQuotes';
import { useTitle } from '../lib/hooks';
import { dirClass, fmtAmount, fmtPrice, fmtRate, marketKo, shortTime } from '../lib/format';
import { errorText } from '../lib/errors';
import { StoryFeed } from '../components/ArticleRow';
// 차트(차트 라이브러리 약 50KB)는 따로 받음 — 화면 묶음을 다 받을 때까지 API 요청이 시작되지 않아 느린 휴대폰에서 첫 글이 3.9초 (11/16 측정)
const PriceChart = lazy(() => import('../components/PriceChart'));
import MentionChart from '../components/MentionChart';
import Board from '../components/Board';
import { ToneRing, leanOf } from '../components/Tone';
import { Empty, ErrorBox, LimitBadge, Pager, Segmented, SkeletonRows } from '../components/ui';
import { useBack } from './NewsDetailPage';
import { dropPriceSentences, moveLead } from '../lib/priceSentence';
import { marketState } from '../lib/market';
import ErrorBoundary from '../components/ErrorBoundary';

const NEWS_SIZE = 10;
const MENTION_PERIODS = [
  { key: 'today', label: '오늘' },
  { key: '7d', label: '7일' },
  { key: '30d', label: '30일' },
];

/** 값이 바뀔 때마다 'tick-up'/'tick-down' 을 잠깐 붙임 (처음 받은 값에는 안 붙임) */
function useTick(value) {
  const prev = useRef(value);
  const [tick, setTick] = useState({ cls: '', n: 0 });
  useEffect(() => {
    if (prev.current != null && value != null && value !== prev.current) {
      setTick((t) => ({ cls: value > prev.current ? 'tick-up' : 'tick-down', n: t.n + 1 }));
    }
    prev.current = value;
  }, [value]);
  return tick;
}

function StockHeader({ code, info, quote, quoteState, paused = false, onTogglePause, priceNews }) {
  const { watchCodes, toggleWatch } = useSession();
  const tick = useTick(quote?.price);
  const watching = watchCodes.has(code);
  const cls = dirClass(quote?.changeRate);
  return (
    <div className="stock-head">
      <div>
        {/* 별 버튼은 제목 밖 (제목 안에 두면 낭독기가 제목을 "삼성전자 관심 종목에 담기"로 읽음 — 11/12 점검) */}
        <div className="stock-name-row">
          <h1 className="stock-name">
            {info?.stockName || <span className="skeleton" style={{ display: 'inline-block', width: 140, height: 28 }} />}
          </h1>
          <button
            type="button"
            className="icon-btn star-btn"
            aria-pressed={watching}
            aria-label={watching ? '관심 종목에서 빼기' : '관심 종목에 담기'}
            title={watching ? '관심 종목에서 빼기' : '관심 종목에 담기'}
            onClick={() => toggleWatch(code, info?.stockName)}
          >
            <Star className="icon" aria-hidden="true" />
          </button>
        </div>
        <p className="stock-sub num">
          <span>{code}</span>
          {info?.market && <span className="badge">{marketKo(info.market)}</span>}
          {info?.sector && <span>{info.sector}</span>}
        </p>
      </div>
      <div className="stock-price">
        {quote ? (
          <>
            <div key={tick.n} className={`price-big ${tick.cls}`}>
              {fmtPrice(quote.price)}원
            </div>
            <div className={`change ${cls}`}>
              {fmtAmount(quote.changeAmount)} ({fmtRate(quote.changeRate)})
              <LimitBadge quote={quote} />
            </div>
            <p className="basis num">
              전일 대비 · {paused ? `${shortTime(quote.fetchedAt)} 값에서 멈춤` : `${quote.live ? '실시간' : `${shortTime(quote.fetchedAt)} 기준`} · ${marketState().label}`}
              {/* WCAG 2.2.2 저절로 바뀌는 정보는 멈출 수 있어야 함 (이해 문서가 실시간 주가를 예로 듦, 11/16 전문가 기준 점검) */}
              {onTogglePause && (
                <button type="button" className="link-btn pause-btn" aria-pressed={paused} onClick={onTogglePause}>
                  {paused ? '실시간 켜기' : '실시간 끄기'}
                </button>
              )}
            </p>
            {/* '오늘 왜 움직였지?' 에 바로 닿게: 오늘 주가를 다룬 기사 (보도된 내용일 뿐 원인 판단 아님 — 11/16 PM 2차 리뷰: 4번째 줄 꼬리표로만 있었음) */}
            {priceNews?.length > 0 && (
              <p className="price-news">
                <span className="k">오늘 주가 기사 {priceNews.length}건</span>
                {/* 기사 시각: 장 초반 '-2%' 기사가 지금 -7% 아래 붙어 지금 값처럼 읽혔음 (11/16 3차 리뷰) */}
                <span className="k num">{shortTime(priceNews[0].publishedAtIso)}</span>
                <Link to={`/news/${priceNews[0].id}`}>{priceNews[0].title}</Link>
              </p>
            )}
          </>
        ) : quoteState.loading ? (
          // 받은 뒤의 높이(현재가·등락·기준 시각 세 줄)만큼 자리를 미리 (11/16 화면 밀림: 44px → 103px 로 커지며 아래가 밀림)
          <div className="skeleton" style={{ width: 160, height: 96 }} />
        ) : (
          <p className="muted">{quoteState.disabled ? '시세 준비 중' : '시세를 받지 못했어요'}</p>
        )}
      </div>
    </div>
  );
}

/** 종합 요약을 문장마다 한 줄씩 (11/13 사용자 눈으로: 8줄짜리 한 덩어리라 휴대폰에서 훑어 읽기 어려웠음).
 *  '~다.' 로 끝나는 곳에서만 나눔 (숫자 속 마침표 '1.5배'는 안 나눔). 한 문장이면 그대로 */
function SummaryText({ text: raw }) {
  const text = dropPriceSentences(raw);
  const lines = String(text).split(/(?<=다\.)\s+/).map((x) => x.trim()).filter(Boolean);
  if (lines.length < 2) return <p style={{ fontSize: 'var(--fs-md)', lineHeight: 1.7 }}>{text}</p>;
  return (
    <ul className="summary-list">
      {lines.map((line, i) => (
        <li key={i}>{line}</li>
      ))}
    </ul>
  );
}

function SummaryCard({ code, summary }) {
  const { user, requireLogin, handleAuthError, toast } = useSession();
  const [override, setOverride] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    setOverride(null);
    setError('');
  }, [code]);
  const s = override || summary.data;

  const regenerate = async () => {
    if (!user) {
      requireLogin('요약 다시 만들기는 로그인하면 쓸 수 있어요.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await stockApi.regenerate(code);
      if (res?.summary) setOverride(res.summary);
      // regenerated=false 는 '10분 안에 이미 요청함(앞 요청이 실패했어도 비용 때문에 다시 안 부름)' 또는 '오늘 기사 없음' (11/16 점검)
      toast(
        res?.regenerated
          ? '오늘 기사로 요약을 새로 만들었어요.'
          : res?.summary?.newsSummary
            ? '방금(10분 안) 요청했거나 오늘 기사가 없어 저장된 요약을 그대로 보여 드려요.'
            : '오늘 기사가 아직 없거나 방금 요청해서 새로 만들지 않았어요.'
      );
    } catch (err) {
      if (!handleAuthError(err)) setError(errorText(err, '요약을 다시 만들지 못했어요. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card" aria-labelledby="sum-title">
      <div className="card-head">
        <h2 className="card-title" id="sum-title">
          <Sparkles className="icon" aria-hidden="true" />
          오늘 AI 요약
        </h2>
        <button type="button" className="btn btn-ghost btn-sm" onClick={regenerate} disabled={busy}>
          <RefreshCw className="icon-sm" aria-hidden="true" />
          {busy ? '만드는 중… (최대 30초)' : '다시 만들기'}
        </button>
      </div>
      {summary.loading && !s && <SkeletonRows rows={2} />}
      {summary.error && !s && <ErrorBox error={summary.error} onRetry={summary.reload} />}
      {s && (s.newsSummary ? (
        <>
          <SummaryText text={s.newsSummary} />
          {s.snsSummary && (
            <>
              <h3 className="link-label">SNS 반응 · 참고용</h3>
              <p className="sub">{s.snsSummary}</p>
            </>
          )}
          {s.generatedAt && <p className="card-note num">{shortTime(s.generatedAt)}에 만든 요약 · AI가 쓴 글이라 틀릴 수 있어요</p>}
        </>
      ) : (
        <p className="sub">오늘 요약이 아직 없어요. 오늘 기사가 모이면 1시간마다 만들어요.</p>
      ))}
      {error && (
        <p className="form-error" role="alert" style={{ marginTop: 10 }}>
          {error}
        </p>
      )}
    </section>
  );
}

function SentimentCard({ summary }) {
  const [basis, setBasis] = useState('article');
  const s = summary.data;
  const ratio = basis === 'event' ? s?.sentimentByEvent : s?.sentiment;
  const count = ratio?.articleCount || 0;
  const few = Boolean(s) && (s?.sentiment?.articleCount || 0) < 3;
  return (
    <section className={`card ${few ? 'sent-few' : ''}`} aria-labelledby="mood-title">
      <div className="card-head">
        <h2 className="card-title" id="mood-title">
          오늘 좋은·나쁜 소식
        </h2>
        {s?.sentimentByEvent && !few && (
          <Segmented
            label="세는 방법"
            size="sm"
            options={[
              { key: 'article', label: '기사마다' },
              { key: 'event', label: '같은 소식은 한 번' },
            ]}
            value={basis}
            onChange={setBasis}
          />
        )}
      </div>
      {summary.loading && !s && <div className="skeleton" style={{ height: 114, borderRadius: 'var(--radius-sm)' }} />}
      {s && count === 0 && <p className="sub">오늘 좋은·나쁜 소식을 판단한 기사가 아직 없어요.</p>}
      {/* 기사 1~2건으로 '좋은 소식 100% · 좋은 소식이 더 많아요'가 나왔음 (11/16 밤 액터: SK스퀘어 -10.5% 날) → 3건 미만은 건수만 */}
      {s && count > 0 && count < 3 && (
        <p className="ratio-legend ratio-few num">
          {(ratio.positiveCount ?? 0) > 0 && <span className="tb-pos">좋은 소식 {ratio.positiveCount}건</span>}
          {(ratio.neutralCount ?? 0) > 0 && <span>판단 없음 {ratio.neutralCount}건</span>}
          {(ratio.negativeCount ?? 0) > 0 && <span className="tb-neg">나쁜 소식 {ratio.negativeCount}건</span>}
          <span className="muted">
            AI가 읽은 {basis === 'event' ? '소식' : '기사'} {count}건 · 3건부터 비율을 보여 줘요
          </span>
        </p>
      )}
      {s && count >= 3 && (
        <>
          {/* 시그니처 링(다른 화면과 같은 표시) + 비율 막대(정확한 비율은 막대가 더 잘 읽힘 — dataviz) */}
          <div className="ratio-ring-line">
            <ToneRing pos={ratio.positiveCount ?? 0} neu={ratio.neutralCount ?? 0} neg={ratio.negativeCount ?? 0} size={36} />
            {(() => {
              const lean = leanOf(ratio.positiveCount ?? 0, ratio.neutralCount ?? 0, ratio.negativeCount ?? 0);
              // '대부분 판단 없음'이 제목 자리를 차지했음 (11/16 밤 impeccable) → 그때는 판단한 기사 수를 제목으로
              if (lean.kind === 'neutral')
                return (
                  <b className="num">
                    좋은 소식 <span className="tb-pos">{ratio.positiveCount ?? 0}건</span> · 나쁜 소식 <span className="tb-neg">{ratio.negativeCount ?? 0}건</span>
                  </b>
                );
              return <b className={lean.kind === 'pos' ? 'tb-pos' : lean.kind === 'neg' ? 'tb-neg' : ''}>{lean.text}</b>;
            })()}
          </div>
          <div className="ratio-bar" role="img" aria-label={`좋은 소식 ${ratio.positive}%, 판단 없음 ${ratio.neutral}%, 나쁜 소식 ${ratio.negative}%`}>
            <span className="ratio-pos" style={{ width: `${ratio.positive}%` }} />
            <span className="ratio-neu" style={{ width: `${ratio.neutral}%` }} />
            <span className="ratio-neg" style={{ width: `${ratio.negative}%` }} />
          </div>
          <p className="ratio-legend">
            <span>
              <i className="ratio-pos" />
              좋은 소식 {ratio.positive}%
            </span>
            <span>
              <i className="ratio-neu" />
              판단 없음 {ratio.neutral}%
            </span>
            <span>
              <i className="ratio-neg" />
              나쁜 소식 {ratio.negative}%
            </span>
            <span className="muted">
              AI가 읽은 오늘 {basis === 'event' ? '소식' : '기사'} {count}건
            </span>
          </p>
        </>
      )}
      {/* 설명 문장 두 줄 → 짧은 꼬리표 한 줄, 자세한 뜻은 마우스를 올리면 (11/16 리뷰 8번) */}
      <p
        className="card-note"
        title={`${basis === 'event' ? '같은 소식을 여러 언론이 써도 한 번만 셌어요. ' : ''}AI가 오늘 기사·공시 내용이 이 회사에 좋은 소식인지 나쁜 소식인지 나눈 비율이에요.`}
      >
        AI 판단 · 주가 예측 아님
      </p>
    </section>
  );
}

function MentionCard({ code }) {
  const [period, setPeriod] = useState('today');
  const m = useApi((signal) => stockApi.mentions(code, period, { signal }), [code, period]);
  return (
    <section className="card" aria-labelledby="mention-title">
      <div className="card-head">
        <h2 className="card-title" id="mention-title">
          언급량
        </h2>
        <Segmented label="기간" size="sm" options={MENTION_PERIODS} value={period} onChange={setPeriod} />
      </div>
      {m.loading && !m.data && <div className="skeleton" style={{ height: 170 }} />}
      {m.error && <ErrorBox error={m.error} onRetry={m.reload} />}
      {m.data && <MentionChart data={m.data} periodLabel={MENTION_PERIODS.find((x) => x.key === period)?.label} />}
    </section>
  );
}

const MOVE_LEVELS = [
  { key: 5, label: '±5% 이상' },
  { key: 3, label: '±3% 이상' },
];
const MOVES_SHOWN = 5;
const WEEKDAY = '일월화수목금토';

/** "2026-11-11" → "11월 11일 (화)" (한국 날짜 그대로, 시간대 변환 없음) */
function dayLabel(date) {
  const [y, m, d] = String(date).split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${m}월 ${d}일 (${WEEKDAY[dow]})`;
}

/** 크게 움직인 날 (F-17 과거 급등·급락 이력): 최근 1년 하루 등락률 ±n% 이상인 날 + 그날 이 종목 기사
 *  11/16: 백엔드에 있던 API 를 화면에 연결. 말은 조심스럽게 — 그날 나온 기사일 뿐 "때문에" 가 아님 */
const todayKst = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

function BigMovesCard({ moves, level, onLevel, todayRate }) {
  const [open, setOpen] = useState(false);
  if (moves.error?.code === 'QUOTE_DISABLED') return null; // 시세가 꺼진 서버: 칸을 숨김
  const items = moves.data?.items || [];
  // 기사 있는 날만 (11/17 사용자: '모든 날 보기'로 펼치면 대부분 기사가 없어 실망 — 기사를 모으기 전 날들).
  // 기사 없는 날은 수만 머리에 밝힘
  const withNews = items.filter((m) => m.articleCount > 0);
  const shown = open ? withNews : withNews.slice(0, MOVES_SHOWN);
  return (
    <section className="card" aria-labelledby="moves-title" id="big-moves">
      <div className="card-head">
        <h2 className="card-title" id="moves-title">
          크게 움직인 날
          {moves.data && items.length > 0 && <span className="count num">최근 1년 {items.length}일 중 기사 있는 날 {withNews.length}일</span>}
        </h2>
        <Segmented label="등락 기준" size="sm" options={MOVE_LEVELS} value={level} onChange={onLevel} />
      </div>
      {moves.loading && !moves.data && <SkeletonRows rows={3} compact />}
      {moves.error && <ErrorBox error={moves.error} onRetry={moves.reload} />}
      {moves.data && items.length === 0 && <Empty title={`최근 1년 동안 하루 ±${level}% 넘게 움직인 날이 없어요`} />}
      {moves.data && items.length > 0 && withNews.length === 0 && (
        <Empty title={`±${level}% 넘게 움직인 ${items.length}일 중 기사가 있는 날은 아직 없어요`} desc="기사를 모으기 전 날이에요. 차트에서 그날 주가는 볼 수 있어요." />
      )}
      {shown.length > 0 && (
        <ul className="moves-list">
          {shown.map((m) => {
            // 대표 = 그날 가장 많이 다뤄진 소식(서버 순서). 주가 기사면 '주가 기사' 표시 — 원인이 아니라 그날 움직임을 다룬 기사
            // (11/16 밤: 주가 기사를 빼니 -5.34% 옆에 '수능 고사장 에어컨 서비스'가 나와 엉뚱했음 → 사용자 결정)
            const lead = moveLead(m);
            const top = lead?.article;
            // 오늘 줄은 머리의 실시간 값으로 (서버 일봉은 캐시라 -7.07% vs 머리 -7.44% 처럼 달랐음 — 4차 리뷰)
            const isToday = m.date === todayKst();
            const rate = isToday && todayRate != null ? todayRate : m.changeRate;
            return (
              <li key={m.date} className="move-row">
                <span className="move-day num">
                  {dayLabel(m.date)}
                  {isToday && marketState().key === 'open' && <small className="muted"> 장중</small>}
                </span>
                <b className={`move-rate num ${dirClass(rate)}`}>{fmtRate(rate)}</b>
                <span className="move-news">
                  {top ? (
                    <>
                      {lead.isPrice && <span className="tag-mini">주가 기사</span>}
                      <Link to={`/news/${top.articleId}`} className="move-title">
                        {top.title}
                      </Link>
                    </>
                  ) : (
                    <span className="muted">그날 연결된 기사 없음</span>
                  )}
                </span>
                {m.articleCount > 0 && <span className="move-count num">기사 {m.articleCount}건</span>}
              </li>
            );
          })}
        </ul>
      )}
      {withNews.length > MOVES_SHOWN ? (
        <button type="button" className="story-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? '접기' : `기사 있는 날 모두 보기 (${withNews.length}일)`}
        </button>
      ) : null}
    </section>
  );
}

function RelatedNews({ code, name }) {
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [code]);
  const list = useApi((signal) => articleApi.list({ stockCode: code, page, size: NEWS_SIZE }, { signal }), [code, page]);
  const items = (list.data?.items || []).map(toUiArticle);
  return (
    <section className="card" aria-labelledby="rel-title" id="related-news">
      <div className="card-head">
        <h2 className="card-title" id="rel-title">
          {name ? `${name} 관련 뉴스·공시` : '관련 뉴스·공시'}
          {list.data && <span className="count num">전체 기간 {list.data.totalCount.toLocaleString('ko-KR')}건</span>}
        </h2>
      </div>
      {list.loading && !list.data && <SkeletonRows rows={4} />}
      {list.error && <ErrorBox error={list.error} onRetry={list.reload} />}
      {list.data && items.length === 0 && <Empty title="이 종목과 연결된 글이 아직 없어요" />}
      {items.length > 0 && (
        <StoryFeed articles={items} focusCode={code} style={{ opacity: list.loading ? 0.5 : 1 }} />
      )}
      {list.data && (
        <Pager
          page={page}
          size={NEWS_SIZE}
          total={list.data.totalCount}
          onChange={(n) => {
            setPage(n);
            document.getElementById('related-news')?.scrollIntoView({ block: 'start' });
          }}
        />
      )}
    </section>
  );
}

// 종목이 바뀌면 화면 전체를 새로 그림 (이전 종목 숫자가 잠깐 보이던 V7 문제)
export default function StockDetailPage() {
  const { code } = useParams();
  return <StockDetail key={code} code={code} />;
}

/** 관심 종목 빠른 전환 (V7 장점): 담은 종목을 칩으로, 지금 종목은 진하게. 로그인·담은 종목이 없으면 안 보임 */
function QuickSwitch({ code }) {
  const { user, checking, watchlist } = useSession();
  const items = user ? watchlist.items.slice(0, 10) : [];
  const { quotes } = useQuotes(items.map((w) => w.stockCode));
  // 로그인 확인·관심 종목을 받는 동안 같은 높이의 빈 자리 (11/16 화면 밀림 측정: 줄이 늦게 생겨 아래가 59px 밀림)
  if (checking || (user && !watchlist.loaded)) return <div className="quick-placeholder" aria-hidden="true" />;
  if (items.length === 0) return null;
  return (
    <nav className="quick" aria-label="관심 종목 바로 가기">
      {/* 별 아이콘은 이름 옆 '담기' 별과 헷갈려(11/16 디자이너 2차 리뷰) 글자만 */}
      <span className="quick-label">내 관심 종목</span>
      {items.map((w) => {
        const q = quotes[w.stockCode];
        return (
          <Link key={w.stockCode} to={`/stocks/${w.stockCode}`} aria-current={w.stockCode === code ? 'page' : undefined}>
            {w.stockName}
            {q && <span className={`change ${dirClass(q.changeRate)}`}>{fmtRate(q.changeRate)}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

/** 섹션 바로 가기 (예전 목업 test/fe-ui-redesign 의 종목 탭에서 가져옴, 11/12):
 * 종목 화면이 길어서(차트 → 요약 → 기사 10건 → 토론) 토론까지 한참 내려가야 했음. 탭으로 화면을 나누지 않고
 * 한 화면에 두되, 위에 붙는 바로 가기 줄로 이동 — 스크롤로 훑는 사람과 바로 가고 싶은 사람 둘 다 */
const SECTIONS = [
  { id: 'sec-summary', label: 'AI 요약' },
  { id: 'sec-chart', label: '차트' },
  { id: 'big-moves', label: '움직인 날' }, // 11/16 F-17 카드 연결
  { id: 'sec-mention', label: '언급량' }, // 화면 순서와 같게 (언급량이 기사 목록보다 위)
  { id: 'related-news', label: '뉴스·공시' },
  { id: 'sec-board', label: '토론' },
];
// 이동 + 주소 # 바꾸기 + 키보드 포커스도 그 칸으로 (11/12 점검: 예전엔 포커스가 바로 가기 줄에 남음.
// 보통 앵커에 맡겨 보니 이 앱 안에서는 주소만 바뀌고 스크롤이 안 됨 → 직접 처리)
function SectionNav({ hide }) {
  const sections = SECTIONS.filter((s) => s.id !== hide); // 시세가 꺼진 서버면 '움직인 날' 칸이 없으므로 링크도 뺌
  // 지금 보이는 구역을 표시 (11/16 디자이너 리뷰: 붙어서 따라오는데 어디인지 안 보여 그냥 글자 줄 같았음)
  const [current, setCurrent] = useState(null);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const els = SECTIONS.map((x) => document.getElementById(x.id)).filter(Boolean);
    const seen = new Map();
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => seen.set(e.target.id, e.isIntersecting));
        // 화면 위치(top)가 가장 위인 구역: 휴대폰은 CSS order 로 순서를 바꿔 배열 순서와 화면 순서가 다름 (11/16 디자이너 2차 리뷰)
        // top 은 지금 다시 잼 (들어올 때 잰 값은 스크롤하면 낡음 — 11/16 3차 코드 리뷰)
        const visible = SECTIONS.filter((x) => seen.get(x.id))
          .map((x) => [x.id, document.getElementById(x.id)?.getBoundingClientRect().top ?? Infinity])
          .sort((a, b) => a[1] - b[1]);
        if (visible.length) setCurrent(visible[0][0]);
      },
      { rootMargin: '-130px 0px -55% 0px' }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  const go = (e, id) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    window.history.replaceState(window.history.state, '', `#${id}`);
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
  };
  return (
    <nav className="sec-nav" aria-label="이 종목 화면 바로 가기">
      {sections.map((s) => (
        <a key={s.id} className={`sn-${s.id}`} href={`#${s.id}`} aria-current={current === s.id ? 'true' : undefined} onClick={(e) => go(e, s.id)}>
          {s.label}
        </a>
      ))}
    </nav>
  );
}

function StockDetail({ code }) {
  const back = useBack('/stocks');
  const info = useApi((signal) => stockApi.get(code, { signal }), [code]);
  const summary = useApi((signal) => stockApi.summary(code, {}, { signal }), [code]);
  // 차트 위 기사 표시 재료: 최근 30일 날마다 기사 수(서버 집계) + 최근 기사 100건(제목·시각)
  const days = useApi((signal) => stockApi.mentions(code, '30d', { signal }), [code]);
  // 최근 기사 100건(차트 분봉 위 기사 표시용, 약 90KB)은 AI 요약이 온 뒤에 받음 — 느린 휴대폰에서 첫 화면 글(LCP)과 대역폭을 다퉜음 (11/16 측정)
  const recent = useApi((signal) => articleApi.list({ stockCode: code, size: 100 }, { signal }), [code], {
    enabled: Boolean(summary.data || summary.error),
  });
  // 실시간 시세가 올 때마다 이 화면이 다시 그려짐 → 받은 데이터가 그대로면 같은 배열을 넘겨 차트가 다시 계산하지 않게 (11/16 2차 코드 리뷰)
  const dayCounts = useMemo(() => (days.data ? (days.data.items || []).map((p) => ({ date: String(p.time).slice(0, 10), count: p.totalCount })) : null), [days.data]);
  const recentArticles = useMemo(() => (recent.data ? (recent.data.items || []).map(toUiArticle) : null), [recent.data]);
  // 이 종목이 중심 종목인 오늘 시세 기사만, 최신순 (함께 언급된 다른 종목 기사가 섞였음 — 11/16 3차 코드 리뷰)
  const priceNews = useMemo(
    () =>
      recentArticles
        ?.filter((a) => a.priceMoveTitle && a.daysAgo === 0 && a.relatedStocks.some((s) => s.code === code && s.role === 'MAIN'))
        .sort((x, y) => String(y.publishedAtIso).localeCompare(String(x.publishedAtIso))),
    [recentArticles, code]
  );
  // 실시간 멈춤: 멈추면 방송(SSE)을 끊고 멈춘 순간의 값을 그대로 보여 줌 (WCAG 2.2.2)
  const [paused, setPaused] = useState(false);
  const { quotes, loading, disabled } = useQuotes([code], { live: !paused });
  const frozenRef = useRef(null);
  if (!paused) frozenRef.current = quotes[code] || null;
  const shownQuote = paused ? frozenRef.current : quotes[code];
  const [moveLevel, setMoveLevel] = useState(5);
  const moves = useApi((signal) => quoteApi.bigMoves(code, { period: '1y', threshold: moveLevel }, { signal }), [code, moveLevel]);
  const stock = info.data?.stockCode === code ? info.data : null;
  useTitle(stock?.stockName || code);

  if (info.error?.status === 404) {
    return (
      <>
        <button type="button" className="back-btn" onClick={back}>
          <ArrowLeft className="icon" aria-hidden="true" />
          뒤로
        </button>
        <div className="card">
          <Empty title={`종목 ${code}을 찾을 수 없어요`} desc="코스피·코스닥 상장 종목만 있어요." action={<Link to="/stocks" className="btn btn-secondary btn-sm">종목 찾기</Link>} />
        </div>
      </>
    );
  }

  return (
    <>
      <button type="button" className="back-btn" onClick={back}>
        <ArrowLeft className="icon" aria-hidden="true" />
        뒤로
      </button>
      <QuickSwitch code={code} />
      {info.error && <ErrorBox error={info.error} onRetry={info.reload} />}
      <StockHeader
        code={code}
        info={stock}
        quote={shownQuote}
        quoteState={{ loading, disabled }}
        paused={paused}
        onTogglePause={() => setPaused((v) => !v)}
        priceNews={priceNews}
      />
      <SectionNav hide={moves.error?.code === 'QUOTE_DISABLED' ? 'big-moves' : null} />
      {/* 휴대폰에서는 순서를 바꿈 (11/13 사용자 눈으로 써 보기: "왜 떨어졌지?"의 답인 AI 요약이 화면 하나를 다 차지하는
          차트 아래에 있어 한참 내려야 했음) → 요약·좋은/나쁜 소식 → 차트 → 기사.
          넓은 화면도 11/16 밤부터 [AI 요약 | 좋은/나쁜 소식] → 차트 → [움직인 날 | 언급량] → 기사 (디자이너: AI 요약이 y≈1128) — CSS .stock-flow */}
      {/* 판단한 기사가 3건 미만이면 좋은·나쁜 소식 카드를 한 줄로 줄이고 AI 요약을 전체 폭으로 (4차 리뷰: 아침엔 카드 절반이 비었음) */}
      <div className={`stock-flow ${(summary.data?.sentiment?.articleCount || 0) < 3 ? 'tone-few' : ''}`}>
        {/* 순서 = 화면 순서 = Tab 순서 (11/16 밤 3차 리뷰: CSS 로만 자리를 바꿔 Tab 이 위아래로 오갔음, WCAG 2.4.3)
            넓은 화면(1081px~): [AI 요약 | 좋은/나쁜 소식] → 차트 → [움직인 날 | 언급량] → 기사. 그보다 좁으면 한 줄씩. 휴대폰은 CSS order 로 좋은/나쁜 소식부터 */}
        <div className="sf-summary">
          <div id="sec-summary" className="sec-anchor" />
          <SummaryCard code={code} summary={summary} />
        </div>
        <div className="sf-sent">
          <SentimentCard summary={summary} />
        </div>
        <div className="sf-chart">
          <div id="sec-chart" className="sec-anchor" />
          <ErrorBoundary compact label="차트" key={code}>
          <Suspense fallback={<section className="card" aria-busy="true"><div className="skeleton" style={{ height: 616, borderRadius: 'var(--radius-sm)' }} /></section>}>
            <PriceChart key={code} stockCode={code} stockName={stock?.stockName || code} dayCounts={dayCounts} articles={recentArticles} moves={moves.data?.items || null} liveQuote={shownQuote || null} />
          </Suspense>
          </ErrorBoundary>
        </div>
        <div className="sf-moves">
          <BigMovesCard moves={moves} level={moveLevel} onLevel={setMoveLevel} todayRate={shownQuote?.changeRate ?? null} />
        </div>
        <div className="sf-mention stack">
          <div id="sec-mention" className="sec-anchor" />
          <MentionCard code={code} />
        </div>
        <div className="sf-news">
          <RelatedNews code={code} name={stock?.stockName} />
        </div>
      </div>
      <div style={{ marginTop: 16 }} id="sec-board" className="sec-anchor-box">
        <Board key={code} stockCode={code} stockName={stock?.stockName || code} />
      </div>
    </>
  );
}
