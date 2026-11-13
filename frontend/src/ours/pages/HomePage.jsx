// 홈 = 한 화면 대시보드 (11/13 피드백: "메인은 스크롤 없이 깔끔하게, 시각화가 맨 처음, 글은 줄이고 나머지는 눌러서 다른 화면")
// 1) 맨 위: 오늘 시장 지도(이슈 12종목: 크기 = 기사 수, 색 = 등락률) 크게 + 옆: 내 관심 종목(로그인) 또는 많이 오른·내린
// 2) 가장 많이 다룬 소식: 1위만 요약, 2~7위는 제목만
// 3) 더 보기 버튼 → 뉴스·종목 화면 (화제 종목 카드·이슈 순위·보도량은 종목·뉴스 화면에서)
// 이전 홈(세 칸 띠·화제 종목 카드·그 밖의 소식·소식 종류·보도량·이슈 순위)은 브랜치 test/fe-ours-1113-before-dashboard
// 말은 조심스럽게: 호재·악재·예측·"때문에" 금지. 등락률은 어제 종가 대비 값
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, LayoutGrid, LogIn, Star } from 'lucide-react';
import { stockApi } from '../../api';
import { useApi } from '../../hooks/useApi';
import { useSession } from '../app/session';
import { useQuotes } from '../lib/useQuotes';
import { useTitle } from '../lib/hooks';
import { fmtRate, todayLabel } from '../lib/format';
import { loadTodayFeed, pickWhy } from '../lib/todayFeed';
import { groupStories } from '../lib/stories';
import TopStories, { rankStories } from '../components/TopStories';
import { usePerStock } from '../components/HotStocks';
import Movers from '../components/Movers';
import MarketMap, { MapLegend } from '../components/MarketMap';
import LivePill from '../components/LivePill';
import { ToneRing, leanOf } from '../components/Tone';
import { PriceCell, SkeletonRows } from '../components/ui';

const MAP_LIMIT = 12; // 시장 지도 종목 수 (시세 요청 10개씩 2번)
const TOP_N = 7; // 1위(요약) + 2~7위(제목만)
const WATCH_N = 6; // 옆 칸 관심 종목 수

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
    <section className="card dash-map" aria-labelledby="map-title">
      <div className="card-head">
        <h2 className="card-title" id="map-title">
          <LayoutGrid className="icon" aria-hidden="true" />
          오늘 시장 지도
        </h2>
        <Link to="/stocks" className="link">
          종목 전체 <ChevronRight className="icon-sm" aria-hidden="true" />
        </Link>
      </div>
      {issues.loading && !issues.data && <div className="skeleton dash-map-box" />}
      {items.length > 0 && <MarketMap tiles={tiles} priceReady={!priceOff && !quoteLoading} height={360} />}
      {items.length > 0 && <MapLegend priceReady={!priceOff} />}
    </section>
  );
}

/** 옆 칸: 내 관심 종목 (로그인) — 종목 · 오늘 좋은/나쁜 소식 링 · 시세 */
function WatchPanel({ quotes, quoteLoading, priceOff }) {
  const { watchlist } = useSession();
  const list = watchlist.items.slice(0, WATCH_N);
  const tones = usePerStock(
    list.map((w) => w.stockCode),
    (code, signal) => stockApi.summary(code, {}, { signal }).then((s) => s?.sentiment || null),
    'tone'
  );
  return (
    <section className="card dash-side" aria-labelledby="watch-title">
      <div className="card-head">
        <h2 className="card-title" id="watch-title">
          <Star className="icon" aria-hidden="true" />
          내 관심 종목
        </h2>
        <Link to="/watchlist" className="link">
          {watchlist.items.length > list.length ? `${watchlist.items.length - list.length}개 더` : '관리'}
          <ChevronRight className="icon-sm" aria-hidden="true" />
        </Link>
      </div>
      <ul className="watch-rows">
        {list.map((w) => {
          const t = tones[w.stockCode];
          const pos = t?.positiveCount || 0;
          const neg = t?.negativeCount || 0;
          const neu = t?.neutralCount || 0;
          return (
            <li key={w.stockCode}>
              <Link to={`/stocks/${w.stockCode}`} className="watch-row">
                <span className="wr-ring" title={pos || neg ? leanOf(pos, neu, neg).text : '오늘 판단한 기사가 아직 없어요'}>
                  {pos || neg ? <ToneRing pos={pos} neu={neu} neg={neg} size={18} /> : <span className="wr-dot" />}
                </span>
                <span className="wr-name">{w.stockName}</span>
                <span className="wr-count num">기사 {w.todayArticleCount}</span>
                {!priceOff &&
                  (quotes[w.stockCode] ? (
                    <PriceCell quote={quotes[w.stockCode]} stacked={false} />
                  ) : quoteLoading ? (
                    <span className="skeleton" style={{ display: 'inline-block', width: 90, height: 16 }} />
                  ) : null)}
              </Link>
            </li>
          );
        })}
      </ul>
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
        <b>내 관심 종목을 여기에</b>
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
  const storyCount = useMemo(() => (feed.data ? groupStories(feed.data.items.filter((a) => !a.isDisclosure)).length : 0), [feed.data]);
  const hasWatch = Boolean(user && watchlist.loaded && watchlist.items.length);
  const watchCodes = hasWatch ? watchlist.items.slice(0, WATCH_N).map((w) => w.stockCode) : [];
  const storyCodes = topStories.flatMap((st) => st.lead.relatedStocks.filter((s) => s.role === 'MAIN').map((s) => s.code));
  const { quotes, loading: quoteLoading, disabled: priceOff } = useQuotes([...new Set([...issueItems.map((i) => i.stockCode), ...watchCodes, ...storyCodes])]);
  const newsCount = feed.data ? feed.data.items.filter((a) => !a.isDisclosure).length : 0;

  return (
    <>
      <div className="page-head home-head dash-head">
        <div style={{ minWidth: 0 }}>
          <p className="eyebrow num">{todayLabel()}</p>
          <h1 className="page-title">오늘의 뉴스 브리핑</h1>
          {topStories.length > 0 && <p className="sr-only">{headline(newsCount, storyCount, issueItems, quotes)}</p>}
        </div>
        <LivePill className="mobile-pill" />
      </div>

      <div className="dash-top">
        <MapCard issues={issues} quotes={quotes} quoteLoading={quoteLoading} priceOff={priceOff} feed={feed} />
        <div className="dash-side-col">
          {hasWatch ? (
            <WatchPanel quotes={quotes} quoteLoading={quoteLoading} priceOff={priceOff} />
          ) : (
            <>
              <Movers issues={issueItems} quotes={quotes} disabled={priceOff} loading={quoteLoading} top={3} title="오늘 많이 오른·내린" />
              <LoginNudge />
            </>
          )}
        </div>
      </div>

      {feed.loading && !feed.data ? (
        <div className="front-page front-dash">
          <div className="story-card story-big">
            <SkeletonRows rows={3} />
          </div>
          <div className="front-side">
            <SkeletonRows rows={5} compact />
          </div>
        </div>
      ) : (
        <TopStories
          stories={topStories}
          quotes={quotes}
          titles
          moreLink={
            <Link to="/news?period=today" className="link">
              소식 전체 <ChevronRight className="icon-sm" aria-hidden="true" />
            </Link>
          }
        />
      )}
      <p className="home-foot">AI 요약은 기사 글을 정리한 것이에요. 등락률은 어제 종가와 비교한 지금 값이고, 기사와 주가의 관계를 뜻하지 않아요.</p>
    </>
  );
}
