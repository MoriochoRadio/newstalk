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
import { rankStories } from '../components/TopStories';
import { usePerStock } from '../components/HotStocks';
import { NewsPulse } from '../components/NewsMap';
import StoryBoard from '../components/StoryBoard';
import LivePill from '../components/LivePill';
import { leanOf } from '../components/Tone';
import { Empty, ErrorBox, SkeletonRows } from '../components/ui';
import { dirClass } from '../lib/format';

const MAP_LIMIT = 12; // 낭독기 문장용 이슈 종목 수
const TOP_N = 5; // 1~5위 제목 목록 (11/13 피드백: 순위만, 여백 없이)
const WATCH_N = 8; // 관심 종목 한 줄
const MAP_STORIES = 6; // 소식 카드 수: 1위 큰 카드 + 5장 = 3줄 (11/16 저녁 지도 → 카드)

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
            오늘 많이 보도된 소식
          </h2>
          <Link to="/news?period=today" className="link">
            소식 전체 <ChevronRight className="icon-sm" aria-hidden="true" />
          </Link>
        </div>
        {feed.error && !feed.data ? (
          <ErrorBox error={feed.error} onRetry={feed.reload} />
        ) : feed.data && newsArticles.length === 0 ? (
          // 자정 직후·수집이 멈췄을 때: 빈 지도 대신 (11/16 발표 아침 대비)
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
          <div className="hero-grid">
            <div className="skeleton" style={{ height: 460, borderRadius: 'var(--radius)' }} />
            <SkeletonRows rows={4} />
          </div>
        ) : (
          <div className="hero-grid">
            <StoryBoard stories={mapStories} />
            <NewsPulse articles={newsArticles} storyCount={storyCount} topics={topics} disclosureCount={(feed.data?.items || []).filter((a) => a.isDisclosure).length} />
          </div>
        )}
      </section>

      {hasWatch && <WatchStrip quotes={quotes} />}

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
