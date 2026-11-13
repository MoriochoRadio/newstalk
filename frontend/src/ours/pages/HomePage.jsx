// 홈 = 오늘의 종목 브리핑. "기사 목록"이 아니라 "우리가 읽어서 정리한 결론"을 먼저 보여 줌 (README 10절)
// 1) 맨 위 한 문장 + 이슈 종목 상위 4개 브리핑 카드(AI 종합 요약·소식 종류·기사/언론 수·평소 대비 보도량·첫 기사 시각)
// 2) 로그인 사용자: 내 관심 종목 오늘 브리핑 (없으면 생략)
// 3) 오늘 시장 지도(이슈 12종목: 크기 = 기사 수, 색 = 등락률) · 시간대별 보도량 · 이슈 순위(추세선) · 오늘 많이 보도된 소식(소식 단위)
// 숫자는 서버 집계(이슈 순위·totalCount·언급량)나 "오늘 글 전부"를 받아서 셈 (100건만 받아 세던 V7 H2 를 되풀이하지 않음)
// 말은 조심스럽게: 호재·악재·예측·"때문에" 금지. 등락률은 어제 종가 대비 값
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, ChevronRight, LayoutGrid, LogIn, Newspaper, Star, TrendingUp } from 'lucide-react';
import { stockApi } from '../../api';
import { useApi } from '../../hooks/useApi';
import { useSession } from '../app/session';
import { useQuotes } from '../lib/useQuotes';
import { useTitle } from '../lib/hooks';
import { dirClass, fmtPrice, fmtRate, todayLabel } from '../lib/format';
import { hourlyCounts, loadTodayFeed, pickWhy } from '../lib/todayFeed';
import { stockDigest } from '../lib/digest';
import { buzzOf } from '../lib/buzz';
import { groupStories } from '../lib/stories';
import { StoryFeed } from '../components/ArticleRow';
import TopStories, { rankStories } from '../components/TopStories';
import TopicMix, { topicMix } from '../components/TopicMix';
import BriefCard from '../components/BriefCard';
import MarketGlance from '../components/MarketGlance';
import MarketMap, { MapLegend } from '../components/MarketMap';
import HourStrip from '../components/HourStrip';
import LivePill from '../components/LivePill';
import Sparkline from '../components/Sparkline';
import { Empty, ErrorBox, Segmented, SkeletonRows } from '../components/ui';

const MAP_LIMIT = 12; // 시장 지도·이슈 순위 종목 수 (시세 요청 10개씩 2번)
const BRIEF_N = 4; // 브리핑 카드 (요약·언급량 요청 각 4번)
const TOP_N = 4; // 맨 위 핵심 소식 (v3, 오늘 글로 계산 — 추가 요청 없음)
const WATCH_N = 4; // 관심 종목 브리핑 (요약 최대 4번 더 → 요약은 홈에서 최대 8번)

/**
 * 종목 여러 개에 같은 API 를 한 번씩. 결과 map: code → 값 | null(실패). 아직이면 키가 없음(undefined)
 * 이미 받은 종목은 다시 부르지 않음 (관심 종목이 이슈 종목과 겹치면 한 번만)
 */
function usePerStock(codes, fetcher, tag) {
  const key = codes.join(',');
  const [map, setMap] = useState({});
  useEffect(() => {
    if (!key) return undefined;
    const controller = new AbortController();
    key.split(',').forEach((code) => {
      fetcher(code, controller.signal)
        .then((v) => setMap((m) => ({ ...m, [code]: v })))
        .catch((err) => {
          if (err.name !== 'AbortError') setMap((m) => ({ ...m, [code]: null }));
        });
    });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tag]);
  return map;
}

/** 맨 위 한 줄 (데이터로 만든 문장, LLM 아님)
 * 11/12 사용자: "가장 많이 다룬 소식은 삼양식품인데 기사가 가장 많은 종목은 NAVER? 이게 뭔 소리야"
 * → 순위 두 개(소식별·종목별)를 한 문장에 넣지 않음. 소식 순위는 바로 아래 '가장 많이 다룬 소식' 칸이 말하고,
 *   여기서는 오늘 전체 양 + 종목 쪽 사실만. 종목 순위는 기사 수(여러 소식 합계)라서 소식 순위와 다를 수 있음 */
// 11/13 사용자 눈으로 써 보기: 첫 문장이 '뉴스 92건, 묶으면 76개' 같은 숫자라 "그래서 오늘 무슨 일?"에 답하지 않음
// → 이슈 종목이 오르고 내린 수 + 가장 크게 움직인 종목을 먼저 (사실만: 기사 때문이라고 말하지 않음), 건수는 뒤에 짧게
function headline(newsCount, storyCount, issues, quotes) {
  const parts = [];
  if (issues.length) {
    const rated = issues.map((i) => ({ i, q: quotes[i.stockCode] })).filter((x) => x.q && x.q.changeRate != null);
    if (rated.length === issues.length) {
      const up = rated.filter((x) => x.q.changeRate > 0).length;
      const down = rated.filter((x) => x.q.changeRate < 0).length;
      parts.push(`오늘 기사가 많은 종목 ${issues.length}개 중 ${up}개가 오르고 ${down}개가 내렸어요.`);
      const big = rated.reduce((a, b) => (Math.abs(b.q.changeRate) > Math.abs(a.q.changeRate) ? b : a));
      if (Math.abs(big.q.changeRate) >= 3) {
        parts.push(`가장 크게 움직인 종목은 ${big.i.stockName}${iEyo(big.i.stockName)}(${fmtRate(big.q.changeRate)}).`);
      }
    } else {
      const top = issues[0];
      parts.push(`오늘 기사가 가장 많은 종목은 ${top.stockName}${iEyo(top.stockName)}(${top.articleCount}건).`);
    }
  }
  if (newsCount) parts.push(`종목과 연결한 뉴스는 ${newsCount}건(같은 소식 ${storyCount}개)이에요.`);
  return parts.join(' ');
}

/** 이름 뒤 '이에요/예요' (받침 있으면 '이에요'). 영문으로 끝나면(NAVER 등) 읽는 소리를 몰라 '예요' */
function iEyo(name) {
  const c = String(name).trim().slice(-1).charCodeAt(0) - 0xac00;
  if (c < 0 || c > 11171) return '예요';
  return c % 28 ? '이에요' : '예요';
}

function BriefSection({ issues, quotes, quoteLoading, priceOff, summaries, buzz, feed }) {
  if (issues.loading && !issues.data) {
    return (
      <div className="brief-grid">
        {Array.from({ length: BRIEF_N }, (_, i) => (
          <div key={i} className="brief">
            <SkeletonRows rows={2} compact />
          </div>
        ))}
      </div>
    );
  }
  if (issues.error) return <ErrorBox error={issues.error} onRetry={issues.reload} />;
  const items = (issues.data?.items || []).slice(0, BRIEF_N);
  if (items.length === 0) {
    return (
      <div className="card">
        <Empty title="오늘 기사에 나온 종목이 아직 없어요" desc="자정이 막 지났다면 첫 기사가 모이는 중이에요." />
      </div>
    );
  }
  const feedItems = feed.data?.items || [];
  return (
    <div className="brief-grid">
      {items.map((it) => {
        const digest = feed.data ? stockDigest(feedItems, it.stockCode) : null;
        const first = feedItems.filter((a) => a.relatedStocks.some((s) => s.code === it.stockCode)).at(-1);
        return (
          <BriefCard
            key={it.stockCode}
            rank={it.rank}
            code={it.stockCode}
            name={it.stockName}
            quote={quotes[it.stockCode]}
            quoteLoading={quoteLoading}
            priceOff={priceOff}
            summary={summaries[it.stockCode] === undefined ? undefined : summaries[it.stockCode]}
            digest={digest}
            buzz={buzz[it.stockCode] ? buzzOf(buzz[it.stockCode]) : null}
            firstAt={feed.data?.complete ? first?.publishedAtIso : null}
            articleCount={it.articleCount}
          />
        );
      })}
    </div>
  );
}

function WatchBrief({ quotes, quoteLoading, priceOff, summaries, feed }) {
  const { user, watchlist } = useSession();
  if (!user || !watchlist.loaded || watchlist.items.length === 0) return null;
  const list = watchlist.items.slice(0, WATCH_N);
  const more = watchlist.items.length - list.length;
  return (
    <section className="home-section" aria-labelledby="watch-brief">
      <div className="section-head">
        <h2 className="section-title" id="watch-brief">
          <Star className="icon" aria-hidden="true" />
          내 관심 종목 오늘
        </h2>
        <Link to="/watchlist" className="link">
          {more > 0 ? `${more}개 더 보기` : '관리'} <ChevronRight className="icon-sm" aria-hidden="true" />
        </Link>
      </div>
      <div className="brief-grid brief-grid-compact">
        {list.map((w) => (
          <BriefCard
            key={w.stockCode}
            code={w.stockCode}
            name={w.stockName}
            quote={quotes[w.stockCode]}
            quoteLoading={quoteLoading}
            priceOff={priceOff}
            summary={summaries[w.stockCode] === undefined ? undefined : summaries[w.stockCode]}
            digest={feed.data?.complete ? stockDigest(feed.data.items, w.stockCode) : null}
            // 오늘 글을 전부 받았으면 이슈 카드와 같은 기준(공시 뺀 뉴스 수), 아니면 관심 종목 API 값
            articleCount={feed.data?.complete ? undefined : w.todayArticleCount}
            compact
          />
        ))}
      </div>
    </section>
  );
}

function MapCard({ issues, quotes, quoteLoading, priceOff, feed }) {
  const items = issues.data?.items || [];
  const tiles = items.map((it) => ({
    code: it.stockCode,
    name: it.stockName,
    articleCount: it.articleCount,
    eventCount: it.eventCount,
    disclosureCount: it.disclosureCount,
    rate: quotes[it.stockCode]?.changeRate ?? null,
    why: feed.data ? pickWhy(feed.data.items, it.stockCode) : null,
  }));
  return (
    <section className="card" aria-labelledby="map-title">
      <div className="card-head">
        <h2 className="card-title" id="map-title">
          <LayoutGrid className="icon" aria-hidden="true" />
          오늘 시장 지도
        </h2>
        <span className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
          기사 많은 {items.length || MAP_LIMIT}종목
        </span>
      </div>
      {issues.loading && !issues.data && <div className="skeleton" style={{ height: 300 }} />}
      {items.length > 0 && <MarketMap tiles={tiles} priceReady={!priceOff && !quoteLoading} height={300} />}
      {items.length > 0 && <MapLegend priceReady={!priceOff} />}
    </section>
  );
}

function HourCard({ feed }) {
  const d = feed.data;
  const rows = useMemo(() => (d ? hourlyCounts(d.items) : []), [d]);
  const news = d ? d.items.filter((a) => !a.isDisclosure).length : 0;
  return (
    <section className="card" aria-labelledby="hour-title">
      <div className="card-head">
        <h2 className="card-title" id="hour-title">
          <BarChart3 className="icon" aria-hidden="true" />
          오늘 보도량
        </h2>
      </div>
      {feed.loading && !d && <div className="skeleton" style={{ height: 150 }} />}
      {feed.error && <ErrorBox error={feed.error} onRetry={feed.reload} />}
      {d && (
        <>
          <div className="kpis">
            <Link to="/news?period=today" className="kpi kpi-accent">
              <span className="kpi-label">종목과 연결된 글</span>
              <span className="kpi-value num">
                {d.total.toLocaleString('ko-KR')}
                <small>건</small>
              </span>
            </Link>
            {d.complete && (
              <>
                <Link to="/news?tab=news&period=today" className="kpi">
                  <span className="kpi-label">뉴스</span>
                  <span className="kpi-value num">
                    {news.toLocaleString('ko-KR')}
                    <small>건</small>
                  </span>
                </Link>
                <Link to="/news?tab=disclosure&period=today" className="kpi">
                  <span className="kpi-label">공시</span>
                  <span className="kpi-value num">
                    {(d.items.length - news).toLocaleString('ko-KR')}
                    <small>건</small>
                  </span>
                </Link>
              </>
            )}
          </div>
          <HourStrip rows={rows} complete={d.complete} total={d.total} />
        </>
      )}
    </section>
  );
}

const RANK_TABS = [
  { key: 'count', label: '기사 많은' },
  { key: 'up', label: '많이 오른' },
  { key: 'down', label: '많이 내린' },
];

function IssueRank({ issues, quotes, quoteLoading, priceOff }) {
  const [tab, setTab] = useState('count');
  const items = issues.data?.items || [];
  const maxCount = Math.max(1, ...items.map((i) => i.articleCount));
  // 부호를 그대로 씀: 오른 탭은 +만, 내린 탭은 -만 (V7 '급하락'에 +5.36% 가 섞이던 문제)
  let rows = items;
  if (tab === 'up') rows = items.filter((i) => quotes[i.stockCode]?.changeRate > 0).sort((a, b) => quotes[b.stockCode].changeRate - quotes[a.stockCode].changeRate);
  if (tab === 'down') rows = items.filter((i) => quotes[i.stockCode]?.changeRate < 0).sort((a, b) => quotes[a.stockCode].changeRate - quotes[b.stockCode].changeRate);
  return (
    <section className="card" aria-labelledby="rank-title">
      <div className="card-head">
        <h2 className="card-title" id="rank-title">
          <TrendingUp className="icon" aria-hidden="true" />
          이슈 종목
        </h2>
        <Link to="/stocks" className="link">
          전체 <ChevronRight className="icon-sm" aria-hidden="true" />
        </Link>
      </div>
      {!priceOff && <Segmented label="줄 세우기" size="sm" options={RANK_TABS} value={tab} onChange={setTab} />}
      {issues.loading && !issues.data && <SkeletonRows rows={5} compact />}
      {items.length > 0 && rows.length === 0 && (
        <p className="sub" style={{ padding: '16px 4px' }}>
          {quoteLoading ? '시세를 받는 중이에요.' : tab === 'up' ? '이슈 종목 중 오른 종목이 없어요.' : '이슈 종목 중 내린 종목이 없어요.'}
        </p>
      )}
      <ol className="rank-rows">
        {rows.map((it) => {
          const q = quotes[it.stockCode];
          return (
            <li key={it.stockCode}>
              <Link to={`/stocks/${it.stockCode}`} className="rank-row">
                <span className="rank num">{it.rank}</span>
                <span className="rank-main">
                  <span className="rank-name">
                    {it.stockName}
                    {it.disclosureCount > 0 && <span className="badge badge-accent">공시 {it.disclosureCount}</span>}
                  </span>
                  <span className="count-bar" aria-hidden="true">
                    <span style={{ width: `${(it.articleCount / maxCount) * 100}%` }} />
                  </span>
                  <span className="rank-meta num">기사 {it.articleCount}건{it.eventCount && it.eventCount !== it.articleCount ? ` · 소식 ${it.eventCount}건` : ''}</span>
                </span>
                <Sparkline code={it.stockCode} name={it.stockName} disabled={priceOff} />
                <span className="rank-price num">
                  {q ? (
                    <>
                      <span className="p">{fmtPrice(q.price)}</span>
                      <span className={`r ${dirClass(q.changeRate)}`}>{fmtRate(q.changeRate)}</span>
                    </>
                  ) : quoteLoading && !priceOff ? (
                    <span className="skeleton" style={{ display: 'inline-block', width: 60, height: 30 }} />
                  ) : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function KeyNews({ feed }) {
  // 그 밖의 소식 (v3): 맨 위 핵심 소식 4개 다음 순서부터 6개. 묶음 크기 순 (관련도순은 작은 종목 기사가 앞에 와서 쓰지 않음)
  const stories = useMemo(() => (feed.data ? rankStories(groupStories, feed.data.items, TOP_N + 6).slice(TOP_N) : []), [feed.data]);
  return (
    <section className="card" aria-labelledby="news-title">
      <div className="card-head">
        <h2 className="card-title" id="news-title">
          <Newspaper className="icon" aria-hidden="true" />
          그 밖의 소식
        </h2>
        <Link to="/news?period=today" className="link">
          오늘 글 전체 <ChevronRight className="icon-sm" aria-hidden="true" />
        </Link>
      </div>
      {feed.loading && !feed.data && <SkeletonRows rows={4} />}
      {feed.error && <ErrorBox error={feed.error} onRetry={feed.reload} />}
      {feed.data && stories.length === 0 && <Empty title="오늘 분석을 마친 뉴스가 아직 없어요" />}
      {stories.length > 0 && <StoryFeed articles={stories.flatMap((s) => [s.lead, ...s.others])} />}
    </section>
  );
}

function LoginNudge() {
  const { user, checking, openAuth } = useSession();
  if (checking || user) return null;
  return (
    <section className="card nudge">
      <Star className="icon" aria-hidden="true" />
      <p>
        <b>관심 종목 브리핑</b>
        <span className="sub">로그인하고 종목을 담으면 맨 위에 그 종목 소식부터 정리해 드려요.</span>
      </p>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => openAuth('login')}>
        <LogIn className="icon-sm" aria-hidden="true" />
        로그인
      </button>
    </section>
  );
}

export default function HomePage() {
  useTitle('');
  const { user, watchlist } = useSession();
  const issues = useApi((signal) => stockApi.issues({ limit: MAP_LIMIT }, { signal }), []);
  const feed = useApi((signal) => loadTodayFeed(signal), []);
  const issueItems = issues.data?.items || [];
  const topStories = useMemo(() => (feed.data ? rankStories(groupStories, feed.data.items, TOP_N) : []), [feed.data]);
  // 오늘 뉴스 전부를 소식으로 묶은 것 (소식 종류 카드 재료, 공시 제외)
  const allStories = useMemo(() => (feed.data ? groupStories(feed.data.items.filter((a) => !a.isDisclosure)) : []), [feed.data]);
  const topicRows = useMemo(() => topicMix(allStories), [allStories]);
  const storyCodes = topStories.flatMap((st) => st.lead.relatedStocks.filter((s) => s.role === 'MAIN').map((s) => s.code));
  const briefCodes = issueItems.slice(0, BRIEF_N).map((i) => i.stockCode);
  const watchCodes = user ? watchlist.items.slice(0, WATCH_N).map((w) => w.stockCode) : [];
  const { quotes, loading: quoteLoading, disabled: priceOff } = useQuotes([...new Set([...storyCodes, ...issueItems.map((i) => i.stockCode), ...watchCodes])]);
  const summaryCodes = [...new Set([...briefCodes, ...watchCodes])];
  const summaries = usePerStock(summaryCodes, (code, signal) => stockApi.summary(code, {}, { signal }), 'summary');
  const buzz = usePerStock(briefCodes, (code, signal) => stockApi.mentions(code, '7d', { signal }), 'mentions');
  const newsCount = feed.data ? feed.data.items.filter((a) => !a.isDisclosure).length : 0;
  const lead = headline(newsCount, allStories.length, issueItems, quotes);

  return (
    <>
      <div className="page-head home-head">
        <div style={{ minWidth: 0 }}>
          <p className="eyebrow num">{todayLabel()}</p>
          <h1 className="page-title">오늘의 뉴스 브리핑</h1>
          {topStories.length ? (
            <>
              {/* 문장은 화면 낭독기용, 눈에는 숫자·색·링 띠 (11/13 페르소나 준호: 글을 안 읽는 사람) */}
              <p className="sr-only">{lead}</p>
              <MarketGlance issues={issueItems} quotes={quotes} articles={feed.data?.items?.filter((a) => !a.isDisclosure)} priceOff={priceOff} />
            </>
          ) : feed.loading ? (
            // 띠와 같은 모양으로 자리를 잡아 둠 (11/13 느린 인터넷 점검: 띠가 늦게 나타나며 아래 내용을 밀어냄)
            <div className="glance" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="glance-tile">
                  <span className="skeleton sk-line" style={{ width: '50%', height: 14, margin: 0 }} />
                  <span className="skeleton sk-line" style={{ width: '80%', height: 31, margin: 0 }} />
                  <span className="skeleton sk-line" style={{ width: '60%', height: 6, margin: 0 }} />
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <LivePill className="mobile-pill" />
      </div>

      {feed.loading && !feed.data ? (
        <div className="front-page">
          <div className="story-card story-big">
            <SkeletonRows rows={3} />
          </div>
          <div className="front-side">
            <SkeletonRows rows={3} compact />
          </div>
        </div>
      ) : (
        <TopStories stories={topStories} quotes={quotes} />
      )}

      <div className="section-head">
        <h2 className="section-title">오늘 화제 종목</h2>
        <p className="section-sub">종목마다 오늘 기사를 모두 센 순서예요. 작은 소식이 여러 개면 위 소식 순위와 달라요.</p>
      </div>
      <BriefSection issues={issues} quotes={quotes} quoteLoading={quoteLoading} priceOff={priceOff} summaries={summaries} buzz={buzz} feed={feed} />
      <WatchBrief quotes={quotes} quoteLoading={quoteLoading} priceOff={priceOff} summaries={summaries} feed={feed} />

      <div className="grid-2 home-grid">
        <div className="stack">
          <MapCard issues={issues} quotes={quotes} quoteLoading={quoteLoading} priceOff={priceOff} feed={feed} />
          <KeyNews feed={feed} />
        </div>
        <div className="stack">
          <LoginNudge />
          <TopicMix rows={topicRows} storyCount={allStories.length} />
          <HourCard feed={feed} />
          <IssueRank issues={issues} quotes={quotes} quoteLoading={quoteLoading} priceOff={priceOff} />
        </div>
      </div>
      <p className="home-foot">AI 요약과 소식 종류는 기사 글을 정리한 것이에요. 등락률은 어제 종가와 비교한 지금 값이고, 기사와 주가의 관계를 뜻하지 않아요.</p>
    </>
  );
}
