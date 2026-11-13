// 홈 = 뉴스 대시보드 (11/13 피드백 2차: "뉴스 중심이니 뉴스 상태를 메인에 크게 한눈에", "시장 지도는 따로 큰 화면으로")
// 1) 맨 위: 오늘 뉴스 한눈에 — 뉴스 지도(소식 칸: 크기 = 기사 수, 색 = 좋은/나쁜 소식) + 오늘 뉴스 수·좋은/나쁜 링·많이 나온 소식
// 2) 로그인: 내 관심 종목 한 줄 (링·등락)
// 3) 가장 많이 다룬 소식: 1~5위 한 줄씩 (순위·좋은/나쁜 점·제목·주인공 종목 등락·기사 수)
// 4) 바로 가기: 시장 지도(/map)·종목·소식 전체
// 이전 홈(세 칸 띠·화제 종목 카드·그 밖의 소식·소식 종류·보도량·이슈 순위)은 브랜치 test/fe-ours-1113-before-dashboard
// 말은 조심스럽게: 호재·악재·예측·"때문에" 금지. 등락률은 어제 종가 대비 값
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, LayoutGrid, Newspaper, Star, TrendingUp } from 'lucide-react';
import { stockApi } from '../../api';
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
import { NewsMap, NewsPulse } from '../components/NewsMap';
import LivePill from '../components/LivePill';
import { ToneRing, leanOf } from '../components/Tone';
import { SkeletonRows } from '../components/ui';
import { dirClass } from '../lib/format';

const MAP_LIMIT = 12; // 낭독기 문장용 이슈 종목 수
const TOP_N = 5; // 1~5위 제목 목록 (11/13 피드백: 순위만, 여백 없이)
const WATCH_N = 8; // 관심 종목 한 줄
const MAP_STORIES = 12; // 뉴스 지도 칸 수 (18칸은 제목이 다 잘림)

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
                  {pos || neg ? <ToneRing pos={pos} neu={neu} neg={neg} size={22} /> : <span className="wr-dot" />}
                  <span className="ws-name">{w.stockName}</span>
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
  const { quotes, loading: quoteLoading, disabled: priceOff } = useQuotes([...new Set([...issueItems.map((i) => i.stockCode), ...watchCodes, ...storyCodes])]);
  const newsArticles = feed.data ? feed.data.items.filter((a) => !a.isDisclosure) : [];
  const newsCount = newsArticles.length;
  const mapStories = useMemo(() => (feed.data ? rankStories(groupStories, feed.data.items, MAP_STORIES) : []), [feed.data]);
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
      </div>

      <section className="card news-hero" aria-labelledby="hero-title">
        <div className="card-head">
          <h2 className="card-title" id="hero-title">
            <Newspaper className="icon" aria-hidden="true" />
            오늘 뉴스 한눈에
          </h2>
          <span className="nm-legend" aria-hidden="true">
            <span><i className="nm-pos" />좋은 소식</span>
            <span><i className="nm-neg" />나쁜 소식</span>
            <span><i className="nm-none" />판단 없음</span>
            <span className="hide-mobile">칸 크기 = 기사 수</span>
          </span>
        </div>
        {feed.loading && !feed.data ? (
          <div className="hero-grid">
            <div className="skeleton" style={{ height: 380, borderRadius: 'var(--radius)' }} />
            <SkeletonRows rows={4} />
          </div>
        ) : (
          <div className="hero-grid">
            <NewsMap stories={mapStories} />
            <NewsPulse articles={newsArticles} storyCount={storyCount} topics={topics} />
          </div>
        )}
      </section>

      {hasWatch && <WatchStrip quotes={quotes} />}

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
          list
          moreLink={
            <Link to="/news?period=today" className="link">
              소식 전체 <ChevronRight className="icon-sm" aria-hidden="true" />
            </Link>
          }
        />
      )}

      <nav className="home-links" aria-label="더 보기">
        <Link to="/map" className="home-link">
          <LayoutGrid className="icon" aria-hidden="true" />
          <span>
            <b>시장 지도</b>
            <small>오늘 기사가 많은 30종목의 등락</small>
          </span>
          <ChevronRight className="icon-sm" aria-hidden="true" />
        </Link>
        <Link to="/stocks" className="home-link">
          <TrendingUp className="icon" aria-hidden="true" />
          <span>
            <b>종목</b>
            <small>오늘 화제 종목·이슈 순위</small>
          </span>
          <ChevronRight className="icon-sm" aria-hidden="true" />
        </Link>
        <Link to="/news?period=today" className="home-link">
          <Newspaper className="icon" aria-hidden="true" />
          <span>
            <b>오늘 소식 전체</b>
            <small>뉴스·공시 {(feed.data?.total || 0).toLocaleString('ko-KR')}건</small>
          </span>
          <ChevronRight className="icon-sm" aria-hidden="true" />
        </Link>
      </nav>
      <p className="home-foot">AI 요약과 좋은·나쁜 소식은 AI가 기사 글을 읽고 나눈 것이에요. 등락률은 어제 종가와 비교한 지금 값이고, 기사와 주가의 관계를 뜻하지 않아요.</p>
    </>
  );
}
