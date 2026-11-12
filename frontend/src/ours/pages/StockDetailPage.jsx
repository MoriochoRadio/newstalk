// 종목 상세: 머리(이름·코드·시장·현재가) → 캔들 차트 → 오늘 AI 요약(다시 만들기) · 감성 비율 · 언급량 → 관련 뉴스(페이지) → 토론
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Sparkles, Star } from 'lucide-react';
import { articleApi, stockApi } from '../../api';
import { toUiArticle } from '../../api/adapters';
import { useApi } from '../../hooks/useApi';
import { useSession } from '../app/session';
import { useQuotes } from '../lib/useQuotes';
import { useTitle } from '../lib/hooks';
import { dirClass, fmtAmount, fmtPrice, fmtRate, relativeTime, shortTime } from '../lib/format';
import { errorText } from '../lib/errors';
import { StoryFeed } from '../components/ArticleRow';
import PriceChart from '../components/PriceChart';
import MentionChart from '../components/MentionChart';
import Board from '../components/Board';
import { Empty, ErrorBox, Pager, Segmented, SkeletonRows } from '../components/ui';
import { useBack } from './NewsDetailPage';

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
        <h1 className="stock-name">
          {info?.stockName || <span className="skeleton" style={{ display: 'inline-block', width: 140, height: 28 }} />}
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
        </h1>
        <p className="stock-sub num">
          <span>{code}</span>
          {info?.market && <span className="badge">{info.market}</span>}
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
          <div className="skeleton" style={{ width: 160, height: 44 }} />
        ) : (
          <p className="muted">{quoteState.disabled ? '시세 준비 중' : '시세를 받지 못했어요'}</p>
        )}
      </div>
    </div>
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
      toast(res?.regenerated ? '오늘 기사로 요약을 새로 만들었어요.' : '10분 안에 만든 요약이 있거나 오늘 기사가 없어 저장된 요약을 보여 드려요.');
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
          <p style={{ fontSize: 15, lineHeight: 1.7 }}>{s.newsSummary}</p>
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
          오늘 기사 분위기
        </h2>
        {s?.sentimentByEvent && (
          <Segmented
            label="세는 방법"
            size="sm"
            options={[
              { key: 'article', label: '기사마다' },
              { key: 'event', label: '같은 소식 1번' },
            ]}
            value={basis}
            onChange={setBasis}
          />
        )}
      </div>
      {summary.loading && !s && <SkeletonRows rows={1} compact />}
      {s && count === 0 && <p className="sub">오늘 분위기를 판단한 기사가 아직 없어요.</p>}
      {s && count > 0 && (
        <>
          <div className="ratio-bar" role="img" aria-label={`좋은 소식 ${ratio.positive}%, 중립 ${ratio.neutral}%, 나쁜 소식 ${ratio.negative}%`}>
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
              중립 {ratio.neutral}%
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
      <p className="card-note">AI가 오늘 기사 내용이 이 회사에 좋은 소식인지 나쁜 소식인지 나눈 비율이에요. 주가 예측이 아니에요.</p>
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
  const { user, watchlist } = useSession();
  const items = user ? watchlist.items.slice(0, 10) : [];
  const { quotes } = useQuotes(items.map((w) => w.stockCode));
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
  { id: 'related-news', label: '뉴스·공시' },
  { id: 'sec-mention', label: '언급량' },
  { id: 'sec-board', label: '토론' },
];
function SectionNav() {
  const go = (e, id) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  };
  return (
    <nav className="sec-nav" aria-label="이 종목 화면 바로 가기">
      {SECTIONS.map((s) => (
        <a key={s.id} href={`#${s.id}`} onClick={(e) => go(e, s.id)}>
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
  const recent = useApi((signal) => articleApi.list({ stockCode: code, size: 100 }, { signal }), [code]);
  const dayCounts = days.data ? (days.data.items || []).map((p) => ({ date: String(p.time).slice(0, 10), count: p.totalCount })) : null;
  const recentArticles = recent.data ? (recent.data.items || []).map(toUiArticle) : null;
  const { quotes, loading, disabled } = useQuotes([code], { live: true });
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
      <div id="sec-chart" className="sec-anchor" />
      <PriceChart key={code} stockCode={code} stockName={stock?.stockName || code} dayCounts={dayCounts} articles={recentArticles} />
      <div className="grid-2" style={{ marginTop: 16 }}>
        <div className="stack">
          <div id="sec-summary" className="sec-anchor" />
          <SummaryCard code={code} summary={summary} />
          <RelatedNews code={code} name={stock?.stockName} />
        </div>
        <div className="stack">
          <SentimentCard summary={summary} />
          <div id="sec-mention" className="sec-anchor" />
          <MentionCard code={code} />
          {summary.data?.generatedAt && (
            <p className="status-line">요약 갱신 {relativeTime(summary.data.generatedAt)}</p>
          )}
        </div>
      </div>
      <div style={{ marginTop: 16 }} id="sec-board" className="sec-anchor-box">
        <Board key={code} stockCode={code} stockName={stock?.stockName || code} />
      </div>
    </>
  );
}
