// 종목 상세: 머리(이름·코드·시장·현재가) → 캔들 차트 → 오늘 AI 요약(다시 만들기) · 감성 비율 · 언급량 → 관련 뉴스(페이지) → 토론
import { Suspense, lazy, useEffect, useRef, useState } from 'react';
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
import { Empty, ErrorBox, Pager, Segmented, SkeletonRows } from '../components/ui';
import { useBack } from './NewsDetailPage';
import { dropPriceSentences } from '../lib/priceSentence';

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

function StockHeader({ code, info, quote, quoteState }) {
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
            </div>
            <p className="basis num">
              어제 종가 대비 · {quote.live ? '실시간' : `${shortTime(quote.fetchedAt)} 기준`}
            </p>
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
  return (
    <section className="card" aria-labelledby="mood-title">
      <div className="card-head">
        <h2 className="card-title" id="mood-title">
          오늘 좋은·나쁜 소식
        </h2>
        {s?.sentimentByEvent && (
          <Segmented
            label="세는 방법"
            size="sm"
            options={[
              { key: 'article', label: '기사 기준' },
              { key: 'event', label: '소식 기준' },
            ]}
            value={basis}
            onChange={setBasis}
          />
        )}
      </div>
      {summary.loading && !s && <div className="skeleton" style={{ height: 114, borderRadius: 'var(--radius-sm)' }} />}
      {s && count === 0 && <p className="sub">오늘 좋은·나쁜 소식을 판단한 기사가 아직 없어요.</p>}
      {s && count > 0 && (
        <>
          {/* 시그니처 링(다른 화면과 같은 표시) + 비율 막대(정확한 비율은 막대가 더 잘 읽힘 — dataviz) */}
          <div className="ratio-ring-line">
            <ToneRing pos={ratio.positiveCount ?? 0} neu={ratio.neutralCount ?? 0} neg={ratio.negativeCount ?? 0} size={36} />
            {(() => {
              const lean = leanOf(ratio.positiveCount ?? 0, ratio.neutralCount ?? 0, ratio.negativeCount ?? 0);
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
              {basis === 'event' ? '소식' : '기사'} {count}건
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
      {m.data && <MentionChart data={m.data} />}
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
function BigMovesCard({ moves, level, onLevel }) {
  const [open, setOpen] = useState(false);
  if (moves.error?.code === 'QUOTE_DISABLED') return null; // 시세가 꺼진 서버: 칸을 숨김
  const items = moves.data?.items || [];
  // 기본은 기사가 있는 날만 (AI 가 기사를 모으기 전인 10월 말 이전 날은 "기사 없음"만 줄줄이 나와서). 없으면 최근 날부터
  const withNews = items.filter((m) => m.articleCount > 0);
  const base = withNews.length ? withNews : items;
  const shown = open ? items : base.slice(0, MOVES_SHOWN);
  return (
    <section className="card" aria-labelledby="moves-title" id="big-moves">
      <div className="card-head">
        <h2 className="card-title" id="moves-title">
          크게 움직인 날
          {moves.data && <span className="count num">최근 1년 {items.length}번{withNews.length ? ` · 기사 있는 날 ${withNews.length}번` : ''}</span>}
        </h2>
        <Segmented label="등락 기준" size="sm" options={MOVE_LEVELS} value={level} onChange={onLevel} />
      </div>
      {moves.loading && !moves.data && <SkeletonRows rows={3} compact />}
      {moves.error && <ErrorBox error={moves.error} onRetry={moves.reload} />}
      {moves.data && items.length === 0 && <Empty title={`최근 1년 동안 하루 ±${level}% 넘게 움직인 날이 없어요`} />}
      {shown.length > 0 && (
        <ul className="moves-list">
          {shown.map((m) => {
            const top = m.articles?.[0];
            return (
              <li key={m.date} className="move-row">
                <span className="move-day num">{dayLabel(m.date)}</span>
                <b className={`move-rate num ${dirClass(m.changeRate)}`}>{fmtRate(m.changeRate)}</b>
                <span className="move-news">
                  {top ? (
                    <Link to={`/news/${top.articleId}`} className="move-title">
                      {top.title}
                    </Link>
                  ) : (
                    <span className="muted">그날 연결된 기사 없음</span>
                  )}
                </span>
                {m.articleCount > 0 && <span className="move-count num">기사 {m.articleCount}</span>}
              </li>
            );
          })}
        </ul>
      )}
      {items.length > shown.length || open ? (
        <button type="button" className="story-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? '접기' : `모든 날 보기 (${items.length}번)`}
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
          {list.data && <span className="count num">{list.data.totalCount.toLocaleString('ko-KR')}건</span>}
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
      <span className="quick-label">
        <Star className="icon-sm" aria-hidden="true" />
        관심
      </span>
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
  { id: 'sec-chart', label: '차트' },
  { id: 'sec-summary', label: 'AI 요약' },
  { id: 'big-moves', label: '움직인 날' }, // 11/16 F-17 카드 연결
  { id: 'related-news', label: '뉴스·공시' },
  { id: 'sec-mention', label: '언급량' },
  { id: 'sec-board', label: '토론' },
];
// 이동 + 주소 # 바꾸기 + 키보드 포커스도 그 칸으로 (11/12 점검: 예전엔 포커스가 바로 가기 줄에 남음.
// 보통 앵커에 맡겨 보니 이 앱 안에서는 주소만 바뀌고 스크롤이 안 됨 → 직접 처리)
function SectionNav() {
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
      {SECTIONS.map((s) => (
        <a key={s.id} className={`sn-${s.id}`} href={`#${s.id}`} onClick={(e) => go(e, s.id)}>
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
  const dayCounts = days.data ? (days.data.items || []).map((p) => ({ date: String(p.time).slice(0, 10), count: p.totalCount })) : null;
  const recentArticles = recent.data ? (recent.data.items || []).map(toUiArticle) : null;
  const { quotes, loading, disabled } = useQuotes([code], { live: true });
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
      <StockHeader code={code} info={stock} quote={quotes[code]} quoteState={{ loading, disabled }} />
      <SectionNav />
      {/* 휴대폰에서는 순서를 바꿈 (11/13 사용자 눈으로 써 보기: "왜 떨어졌지?"의 답인 AI 요약이 화면 하나를 다 차지하는
          차트 아래에 있어 한참 내려야 했음) → 요약·좋은/나쁜 소식 → 차트 → 기사. 넓은 화면은 그대로 (CSS .stock-flow) */}
      <div className="stock-flow">
        <div className="sf-chart">
          <div id="sec-chart" className="sec-anchor" />
          <Suspense fallback={<section className="card" aria-busy="true"><div className="skeleton" style={{ height: 556, borderRadius: 'var(--radius-sm)' }} /></section>}>
            <PriceChart key={code} stockCode={code} stockName={stock?.stockName || code} dayCounts={dayCounts} articles={recentArticles} moves={moves.data?.items || null} liveQuote={quotes[code] || null} />
          </Suspense>
        </div>
        <div className="grid-2 sf-grid">
          <div className="stack sf-stack">
            <div className="sf-summary">
              <div id="sec-summary" className="sec-anchor" />
              <SummaryCard code={code} summary={summary} />
            </div>
            <div className="sf-moves">
              <BigMovesCard moves={moves} level={moveLevel} onLevel={setMoveLevel} />
            </div>
            <div className="sf-news">
              <RelatedNews code={code} name={stock?.stockName} />
            </div>
          </div>
          <div className="stack sf-stack">
            <div className="sf-sent">
              <SentimentCard summary={summary} />
            </div>
            <div className="sf-mention stack">
              <div id="sec-mention" className="sec-anchor" />
              <MentionCard code={code} />
            </div>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 16 }} id="sec-board" className="sec-anchor-box">
        <Board key={code} stockCode={code} stockName={stock?.stockName || code} />
      </div>
    </>
  );
}
