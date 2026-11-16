// 홈 = 뉴스 대시보드 (11/13 피드백 2차: "뉴스 중심이니 뉴스 상태를 메인에 크게 한눈에", "시장 지도는 따로 큰 화면으로")
// 1) 맨 위: 오늘 뉴스 한눈에 — 뉴스 지도(소식 칸: 크기 = 기사 수, 색 = 좋은/나쁜 소식) + 오늘 뉴스 수·좋은/나쁜 링·많이 나온 소식
// 2) 로그인: 내 관심 종목 한 줄 (링·등락)
// 3) 가장 많이 다룬 소식: 1~5위 한 줄씩 (순위·좋은/나쁜 점·제목·주인공 종목 등락·기사 수)
// 4) 바로 가기: 시장 지도(/map)·종목·소식 전체
// 이전 홈(세 칸 띠·화제 종목 카드·그 밖의 소식·소식 종류·보도량·이슈 순위)은 브랜치 test/fe-ours-1113-before-dashboard
// 말은 조심스럽게: 호재·악재·예측·"때문에" 금지. 등락률은 어제 종가 대비 값
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronRight, LayoutGrid, Newspaper, Star, TrendingUp } from 'lucide-react';
import { quoteApi, stockApi } from '../../api';
import { useApi } from '../../hooks/useApi';
import { useSession } from '../app/session';
import { useQuotes } from '../lib/useQuotes';
import { useTitle } from '../lib/hooks';
import { fmtPrice, fmtRate, todayLabel } from '../lib/format';
import { loadTodayFeed } from '../lib/todayFeed';
import { topicMix } from '../components/TopicMix';
import { groupStories } from '../lib/stories';
import TopStories, { rankStories } from '../components/TopStories';
import { usePerStock } from '../components/HotStocks';
import HomeSummary from '../components/HomeSummary';
import { NewsMap, NewsPulse } from '../components/NewsMap';
import WordCloud from '../components/WordCloud';
import CapMap, { CapLegend } from '../components/CapMap';
import HomeKpi from '../components/HomeKpi';
import { limitOf } from '../components/ui';
import { pickWhy } from '../lib/todayFeed';
import { marketTerms } from '../lib/marketTerms';
import StoryBoard from '../components/StoryBoard';
import LivePill from '../components/LivePill';
import { leanOf } from '../components/Tone';
import { Empty, ErrorBox, Segmented, SkeletonRows } from '../components/ui';
import { dirClass } from '../lib/format';

const MAP_LIMIT = 30; // 이슈 종목 수 (낭독기 문장 + 종목 지도 대신용)
const TOP_N = 5; // 1~5위 제목 목록 (11/13 피드백: 순위만, 여백 없이)
const WATCH_N = 8; // 관심 종목 한 줄
const MAP_STORIES = 8; // 많이 보도된 소식 목록 줄 수 (11/16 저녁 지도 → 큼직한 목록)
const MAP_TILES = 12; // 시안 '뉴스 지도'의 칸 수

// 홈 시안 비교 (11/16 저녁 사용자: 뉴스 지도 / 요약+목록 / 단어 구름을 비교) — 주소 ?home=map|list|cloud, 고른 것은 기억
const VARIANTS = [
  { key: 'map', label: '뉴스 지도' },
  { key: 'list', label: '요약 + 목록' },
  { key: 'cloud', label: '단어 구름' },
  { key: 'stock', label: '종목 지도' },
];
const VARIANT_KEY = 'snm_home_variant';
function useHomeVariant() {
  const [params, setParams] = useSearchParams();
  const [saved, setSaved] = useState(() => {
    try {
      return localStorage.getItem(VARIANT_KEY);
    } catch {
      return null;
    }
  });
  const fromUrl = params.get('home');
  const v = VARIANTS.some((x) => x.key === fromUrl) ? fromUrl : VARIANTS.some((x) => x.key === saved) ? saved : 'list';
  const set = (k) => {
    setSaved(k);
    try {
      localStorage.setItem(VARIANT_KEY, k);
    } catch {
      // 기억 못 해도 이번 화면은 바뀜
    }
    const p = new URLSearchParams(params);
    p.set('home', k);
    setParams(p, { replace: true });
  };
  return [v, set];
}

/** 화면 낭독기용 한 줄 (눈에는 지도가 말함). 데이터로 만든 문장, LLM 아님. 사실만: 기사 때문이라고 말하지 않음 */
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

/** 내 관심 종목 한 줄 (로그인): 종목 · 오늘 좋은/나쁜 소식 링 · 등락 — 가로로 (11/13: 관심 종목이 아래에 묻혀 불편) */
function WatchStrip({ quotes }) {
  const { watchlist } = useSession();
  const list = watchlist.items.slice(0, WATCH_N);
  const tones = usePerStock(
    list.map((w) => w.stockCode),
    (code, signal) => stockApi.summary(code, {}, { signal }).then((x) => x?.sentiment || null),
    'tone'
  );
  return (
    <section className="watch-strip" aria-labelledby="watch-title">
      <h2 className="ws-head" id="watch-title">
        <Star className="icon-sm" aria-hidden="true" />내 관심 종목
      </h2>
      <ul>
        {list.map((w) => {
          const t = tones[w.stockCode];
          const pos = t?.positiveCount || 0;
          const neg = t?.negativeCount || 0;
          const neu = t?.neutralCount || 0;
          const q = quotes[w.stockCode];
          return (
            <li key={w.stockCode}>
              <Link to={`/stocks/${w.stockCode}`} className="ws-card" title={pos || neg ? leanOf(pos, neu, neg).text : '오늘 판단한 기사가 아직 없어요'}>
                <span className="ws-top">
                  <span className="ws-name">{w.stockName}</span>
                </span>
                {/* 글자 없는 22px 링은 '불러오는 중' 표시처럼 보였음 → 짧은 글자로 (11/16 디자이너 2차 리뷰, WCAG 1.4.1).
                    줄은 늘 두어 판단이 늦게 와도 카드 높이가 그대로 */}
                <span className="ws-tone num">
                  {pos > 0 && <b className="good">좋은 소식 {pos}건</b>}
                  {neg > 0 && <b className="bad">나쁜 소식 {neg}건</b>}
                  {!pos && !neg && <span aria-hidden="true">&nbsp;</span>}
                </span>
                <span className="ws-price num">
                  {q && q.price != null ? <span>{fmtPrice(q.price)}</span> : <span className="muted">–</span>}
                  {q && q.changeRate != null && <b className={dirClass(q.changeRate)}>{fmtRate(q.changeRate)}</b>}
                </span>
              </Link>
            </li>
          );
        })}
        <li>
          <Link to="/watchlist" className="ws-card ws-more">
            관리 <ChevronRight className="icon-sm" aria-hidden="true" />
          </Link>
        </li>
      </ul>
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
  const storyCount = useMemo(() => (feed.data ? groupStories(feed.data.items.filter((a) => !a.isDisclosure)).length : 0), [feed.data]);
  const hasWatch = Boolean(user && watchlist.loaded && watchlist.items.length);
  const watchCodes = hasWatch ? watchlist.items.slice(0, WATCH_N).map((w) => w.stockCode) : [];
  const storyCodes = topStories.flatMap((st) => st.lead.relatedStocks.filter((s) => s.role === 'MAIN').map((s) => s.code));
  const { quotes } = useQuotes([...new Set([...issueItems.map((i) => i.stockCode), ...watchCodes, ...storyCodes])]);
  const newsArticles = feed.data ? feed.data.items.filter((a) => !a.isDisclosure) : [];
  const newsCount = newsArticles.length;
  const [variant, setVariant] = useHomeVariant();
  const tileStories = useMemo(() => (feed.data ? rankStories(groupStories, feed.data.items, MAP_TILES) : []), [feed.data]);
  const mapStories = tileStories.slice(0, MAP_STORIES);
  // 시안 '종목 지도': 시가총액 지도 + 칸마다 오늘 기사 수 (11/16 저녁 사용자: FINVIZ 지도처럼)
  const capMap = useApi((signal) => quoteApi.marketMap({ signal }), [variant], { enabled: variant === 'stock' });
  const capNews = useMemo(() => {
    if (!feed.data || variant !== 'stock') return {};
    const out = {};
    const news = feed.data.items.filter((a) => !a.isDisclosure);
    (capMap.data?.items || []).forEach((it) => {
      const n = news.filter((a) => a.relatedStocks.some((s) => s.code === it.stockCode)).length;
      if (n) out[it.stockCode] = { count: n, top: pickWhy(news, it.stockCode) };
    });
    return out;
  }, [feed.data, capMap.data, variant]);
  const terms = useMemo(() => (feed.data && (variant === 'cloud' || variant === 'stock') ? marketTerms(groupStories(feed.data.items.filter((a) => !a.isDisclosure))) : []), [feed.data, variant]);
  const topics = useMemo(() => (feed.data ? topicMix(groupStories(newsArticles)) : []), [feed.data]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div className="page-head home-head dash-head">
        <div style={{ minWidth: 0 }}>
          <p className="eyebrow num">{todayLabel()}</p>
          <h1 className="page-title">오늘의 뉴스 브리핑</h1>
          {topStories.length > 0 && <p className="sr-only">{headline(newsCount, storyCount, issueItems, quotes)}</p>}
        </div>
        <LivePill className="mobile-pill" />
        {/* 시안 비교 (임시): 팀 회의에서 고른 뒤 뺌 */}
        <div className="home-variant">
          <span className="muted">홈 시안</span>
          <Segmented label="홈 시안 고르기" size="sm" options={VARIANTS} value={variant} onChange={setVariant} />
        </div>
      </div>

      {/* 1) 한눈에 요약: 숫자·막대로 먼저 (11/16 저녁 사용자: "시각화로 먼저 떠먹여 주고, 그 밑에 자세히") */}
      <section className="card news-hero" aria-labelledby="hero-title">
        <div className="card-head">
          <h2 className="card-title" id="hero-title">
            <Newspaper className="icon" aria-hidden="true" />
            {variant === 'map' ? '오늘 뉴스 한눈에' : variant === 'cloud' ? '오늘 시장, 단어로 한눈에' : variant === 'stock' ? '오늘 시장 지도' : '오늘 한눈에'}
          </h2>
          {variant === 'map' && (
            <span className="nm-legend" aria-hidden="true">
              <span><i className="nm-pos" />좋은 소식</span>
              <span><i className="nm-neg" />나쁜 소식</span>
              <span><i className="nm-none" />판단 없음</span>
              <span className="hide-mobile">칸 하나 = 소식 하나 · 크기 = 그 소식 기사 수</span>
            </span>
          )}
          {variant === 'cloud' && (
            <span className="nm-legend" aria-hidden="true">
              <span><i className="nm-pos" />주로 좋은 소식</span>
              <span><i className="nm-neg" />주로 나쁜 소식</span>
              <span className="hide-mobile">글자 크기 = 그 말이 나온 소식 수</span>
            </span>
          )}
        </div>
        {feed.error && !feed.data ? (
          <ErrorBox error={feed.error} onRetry={feed.reload} />
        ) : feed.data && newsArticles.length === 0 ? (
          // 자정 직후·수집이 멈췄을 때 (11/16 발표 아침 대비)
          <Empty
            icon={Newspaper}
            title="아직 오늘 뉴스가 없어요"
            action={
              <div className="empty-actions">
                <Link to="/news?period=7d" className="btn btn-primary btn-sm">
                  최근 7일 소식
                </Link>
                <Link to="/map" className="btn btn-secondary btn-sm">
                  시장 지도
                </Link>
              </div>
            }
          />
        ) : feed.loading && !feed.data ? (
          <div className="skeleton" style={{ height: 150, borderRadius: 'var(--radius)' }} />
        ) : (
          <>
            {variant === 'stock' ? (
              <>
                {/* ① 오늘 숫자 띠 (증권 앱 지수 띠처럼) */}
                <HomeKpi articles={newsArticles} disclosureCount={(feed.data?.items || []).filter((a) => a.isDisclosure).length} />
                {/* ② 종목 지도: 시가총액 지도. 서버가 아직 모르면(백엔드 브랜치 합치기 전) 같은 모양으로 '오늘 기사 많은 종목'(크기 = 기사 수) */}
                {capMap.data?.items?.length ? (
                  <>
                    <CapMap items={capMap.data.items} news={capNews} />
                    <CapLegend />
                  </>
                ) : capMap.error || issueItems.length ? (
                  <>
                    <CapMap
                      items={issueItems.map((it) => ({
                        stockCode: it.stockCode,
                        stockName: it.stockName,
                        sector: '',
                        marketCap: it.articleCount,
                        changeRate: quotes[it.stockCode]?.changeRate ?? null,
                        priceLimit: { up: 'UPPER', down: 'LOWER' }[limitOf(quotes[it.stockCode])] ?? null,
                      }))}
                      news={Object.fromEntries(issueItems.map((it) => [it.stockCode, { count: it.articleCount, top: feed.data ? pickWhy(newsArticles, it.stockCode) : null }]))}
                      height={460}
                    />
                    <CapLegend size="오늘 기사 수 (시가총액 지도는 새 서버를 켜면 보여요)" grouped={false} />
                  </>
                ) : (
                  <div className="skeleton" style={{ height: 520, borderRadius: 'var(--radius)' }} />
                )}
                {/* ③ 오늘 많이 나온 말: '많이 나온 주제 · 소식 n개' 숫자 칸 대신 단어 구름 (11/16 사용자) */}
                {terms.length > 0 && (
                  <div className="home-words">
                    <h3 className="hs-k">오늘 기사에 많이 나온 말</h3>
                    <WordCloud terms={terms} height={240} />
                  </div>
                )}
              </>
            ) : variant === 'map' ? (
              <div className="hero-grid">
                <NewsMap stories={tileStories} variant="stock" />
                <NewsPulse articles={newsArticles} storyCount={storyCount} topics={topics} disclosureCount={(feed.data?.items || []).filter((a) => a.isDisclosure).length} />
              </div>
            ) : (
              <>
                {variant === 'cloud' && <WordCloud terms={terms} />}
                <HomeSummary
                  articles={newsArticles}
                  storyCount={storyCount}
                  disclosureCount={(feed.data?.items || []).filter((a) => a.isDisclosure).length}
                  topics={topics}
                  issues={issueItems}
                />
              </>
            )}
          </>
        )}
      </section>

      {hasWatch && <WatchStrip quotes={quotes} />}

      {/* 2) 자세히: 많이 보도된 소식을 큼직한 목록으로 (지도·카드판 대신 — 긴 제목이 다 읽히게) */}
      {(variant === 'map' || variant === 'stock') && feed.data && (
        <TopStories
          stories={topStories}
          quotes={quotes}
          list
          moreLink={
            <Link to="/news?period=today" className="link">
              소식 전체 <ChevronRight className="icon-sm" aria-hidden="true" />
            </Link>
          }
        />
      )}
      {variant !== 'map' && variant !== 'stock' && !(feed.data && newsArticles.length === 0) && !(feed.error && !feed.data) && (
        <section className="card" aria-labelledby="rank-title">
          <div className="card-head">
            <h2 className="card-title" id="rank-title">
              오늘 많이 보도된 소식
            </h2>
            <Link to="/news?period=today" className="link">
              소식 전체 <ChevronRight className="icon-sm" aria-hidden="true" />
            </Link>
          </div>
          {feed.loading && !feed.data ? <SkeletonRows rows={5} /> : <StoryBoard stories={mapStories} />}
        </section>
      )}


      <nav className="home-links" aria-label="더 보기">
        <Link to="/map" className="home-link">
          <LayoutGrid className="icon" aria-hidden="true" />
          <span>
            <b>시장 지도</b>
            <small>화제 종목 30개의 등락</small>
          </span>
          <ChevronRight className="icon-sm" aria-hidden="true" />
        </Link>
        <Link to="/stocks" className="home-link">
          <TrendingUp className="icon" aria-hidden="true" />
          <span>
            <b>종목</b>
            <small>오늘 화제 종목 순위</small>
          </span>
          <ChevronRight className="icon-sm" aria-hidden="true" />
        </Link>
        <Link to="/news?period=today" className="home-link">
          <Newspaper className="icon" aria-hidden="true" />
          <span>
            <b>오늘 기사·공시 전체</b>
            <small>{(feed.data?.total || 0).toLocaleString('ko-KR')}건</small>
          </span>
          <ChevronRight className="icon-sm" aria-hidden="true" />
        </Link>
      </nav>
    </>
  );
}
