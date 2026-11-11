// 홈: 오늘 시장 한눈에 — 오늘의 이슈 종목(왜 한 줄) → 주요 뉴스 → 관심 종목 소식 → 데이터 갱신 시각
// 숫자는 화면에서 세지 않고 서버 집계(이슈 순위·totalCount·상태 API)를 그대로 씀
// 지수·환율 API 가 없어 "시장 지표" 칸은 두지 않음 (빈 "연동 전" 막대 대신 생략)
import { Link } from 'react-router-dom';
import { ChevronRight, Clock, LogIn, Newspaper, Star, TrendingUp } from 'lucide-react';
import { articleApi, statusApi, stockApi, watchlistApi } from '../../api';
import { toUiArticle } from '../../api/adapters';
import { useApi } from '../../hooks/useApi';
import { useSession } from '../app/session';
import { useQuotes } from '../lib/useQuotes';
import { useTitle } from '../lib/hooks';
import { relativeTime, shortTime, todayLabel } from '../lib/format';
import ArticleRow from '../components/ArticleRow';
import Movers from '../components/Movers';
import { Empty, ErrorBox, PriceCell, SkeletonRows } from '../components/ui';

const ISSUE_LIMIT = 7;

/**
 * 이슈 종목마다 "왜" 한 줄 = 그 종목이 주인공인 오늘 최신 기사 제목
 * (종목마다 GET /api/articles?stockCode=&period=today&size=10 한 번. 주인공 글이 없으면 첫 글)
 */
async function loadIssues(signal) {
  const res = await stockApi.issues({ limit: ISSUE_LIMIT }, { signal });
  const items = res?.items || [];
  const whys = await Promise.allSettled(
    items.map((it) => articleApi.list({ stockCode: it.stockCode, period: 'today', size: 10 }, { signal }))
  );
  return items.map((it, i) => {
    const list = whys[i].status === 'fulfilled' ? (whys[i].value?.items || []).map(toUiArticle) : [];
    const pick =
      list.find((a) => !a.isDisclosure && a.relatedStocks.some((s) => s.code === it.stockCode && s.role === 'MAIN')) ||
      list.find((a) => !a.isDisclosure) ||
      list[0];
    return { ...it, why: pick ? { id: pick.id, title: pick.title } : null };
  });
}

/**
 * 주요 뉴스 = 오늘 많이 보도된 소식: 오늘 뉴스 100건(최신순)을 같은 소식 묶음으로 합치고 묶음 크기 순.
 * 묶음마다 첫 보도 기사를 대표로 (없으면 가장 먼저 받은 글). 관련도순은 작은 종목 기사가 앞에 와서 쓰지 않음
 */
async function loadKeyNews(signal) {
  const res = await articleApi.list({ period: 'today', source: 'NEWS', size: 100 }, { signal });
  const groups = new Map();
  for (const a of (res?.items || []).map(toUiArticle)) {
    if (a.isDisclosure) continue;
    const main = a.relatedStocks.find((s) => s.role === 'MAIN');
    // 같은 종목·같은 묶음(크기·첫 보도 언론사가 같음)은 하나로
    const key = main && a.sameNewsCount >= 2 ? `${main.code}:${a.sameNewsCount}:${a.firstReportPress}` : `id:${a.id}`;
    const prev = groups.get(key);
    if (!prev || (a.firstReport && !prev.firstReport)) groups.set(key, a);
  }
  const items = [...groups.values()]
    .sort((x, y) => (y.sameNewsCount || 1) - (x.sameNewsCount || 1) || (y.publishedAtIso > x.publishedAtIso ? 1 : -1))
    .slice(0, 5);
  return { items, totalToday: res?.totalCount ?? 0 };
}

function IssueList({ issues, quotes, quoteLoading, disabled }) {
  return (
    <section className="card" aria-labelledby="home-issues">
      <div className="card-head">
        <h2 className="card-title" id="home-issues">
          <TrendingUp className="icon" aria-hidden="true" />
          오늘의 이슈 종목
        </h2>
        <Link to="/stocks" className="link">
          전체 순위 <ChevronRight className="icon-sm" aria-hidden="true" />
        </Link>
      </div>
      {issues.loading && !issues.data && <SkeletonRows rows={5} compact />}
      {issues.error && <ErrorBox error={issues.error} onRetry={issues.reload} />}
      {issues.data && issues.data.length === 0 && (
        <Empty title="오늘 기사에 나온 종목이 아직 없어요" desc="자정이 막 지났다면 첫 기사가 모이는 중이에요." />
      )}
      {issues.data && issues.data.length > 0 && (
        <ol className="stock-rows">
          {issues.data.map((it) => (
            <li key={it.stockCode}>
              <Link to={`/stocks/${it.stockCode}`} className="stock-row">
                <span className="rank">{it.rank}</span>
                <span style={{ minWidth: 0 }}>
                  <span className="stock-row-name">
                    {it.stockName}
                    {it.disclosureCount > 0 && <span className="badge badge-accent">공시 {it.disclosureCount}</span>}
                  </span>
                  {it.why && <span className="stock-row-why" style={{ display: 'block' }}>{it.why.title}</span>}
                  <span className="stock-row-meta num" style={{ display: 'block' }}>
                    기사 {it.articleCount}건{it.eventCount && it.eventCount !== it.articleCount ? ` · 소식 ${it.eventCount}건` : ''}
                    {it.lastPublishedAt ? ` · 최근 ${shortTime(it.lastPublishedAt)}` : ''}
                  </span>
                </span>
                {quoteLoading && !quotes[it.stockCode] ? (
                  <span className="skeleton" style={{ width: 64, height: 32 }} />
                ) : disabled ? null : (
                  <PriceCell quote={quotes[it.stockCode]} />
                )}
              </Link>
            </li>
          ))}
        </ol>
      )}
      {issues.data && issues.data.length > 0 && (
        <p className="card-note">오늘 0시부터 나온 뉴스 기사 수 순서예요. 등락률은 어제 종가와 비교한 지금 값이에요.</p>
      )}
    </section>
  );
}

function KeyNews() {
  const news = useApi((signal) => loadKeyNews(signal), []);
  return (
    <section className="card" aria-labelledby="home-news">
      <div className="card-head">
        <h2 className="card-title" id="home-news">
          <Newspaper className="icon" aria-hidden="true" />
          오늘 많이 보도된 소식
        </h2>
        <Link to="/news?period=today" className="link">
          오늘 뉴스·공시 {news.data ? `${news.data.totalToday.toLocaleString('ko-KR')}건` : '전체'} <ChevronRight className="icon-sm" aria-hidden="true" />
        </Link>
      </div>
      {news.loading && !news.data && <SkeletonRows rows={4} />}
      {news.error && <ErrorBox error={news.error} onRetry={news.reload} />}
      {news.data && news.data.items.length === 0 && <Empty title="오늘 분석을 마친 뉴스가 아직 없어요" />}
      {news.data && news.data.items.length > 0 && (
        <div className="feed">
          {news.data.items.map((a) => (
            <ArticleRow key={a.id} article={a} />
          ))}
        </div>
      )}
    </section>
  );
}

function WatchNews() {
  const { user, checking, openAuth, watchlist } = useSession();
  const enabled = Boolean(user);
  const news = useApi((signal) => watchlistApi.articles({ period: '7d', size: 5 }, { signal }), [user?.loginId, watchlist.items.length], {
    enabled,
  });
  const items = (news.data?.items || []).map(toUiArticle);

  return (
    <section className="card" aria-labelledby="home-watch">
      <div className="card-head">
        <h2 className="card-title" id="home-watch">
          <Star className="icon" aria-hidden="true" />
          관심 종목 소식
        </h2>
        {user && (
          <Link to="/watchlist" className="link">
            관리 <ChevronRight className="icon-sm" aria-hidden="true" />
          </Link>
        )}
      </div>
      {checking && <SkeletonRows rows={2} compact />}
      {!checking && !user && (
        <Empty
          icon={Star}
          title="관심 종목 소식을 한곳에서"
          desc="로그인하고 종목을 담으면 그 종목 기사만 모아 보여 드려요."
          action={
            <button type="button" className="btn btn-primary btn-sm" onClick={() => openAuth('login')}>
              <LogIn className="icon-sm" aria-hidden="true" />
              로그인
            </button>
          }
        />
      )}
      {user && watchlist.loaded && watchlist.items.length === 0 && (
        <Empty icon={Star} title="담은 종목이 없어요" desc="종목 화면의 별 버튼으로 담을 수 있어요." action={<Link to="/stocks" className="btn btn-secondary btn-sm">종목 둘러보기</Link>} />
      )}
      {user && watchlist.items.length > 0 && (
        <>
          {news.loading && !news.data && <SkeletonRows rows={3} compact />}
          {news.error && <ErrorBox error={news.error} onRetry={news.reload} />}
          {news.data && items.length === 0 && <Empty title="최근 7일 동안 관심 종목 기사가 없어요" />}
          {items.length > 0 && (
            <div className="feed feed-compact">
              {items.map((a) => (
                <ArticleRow key={a.id} article={a} compact />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function DataStatus() {
  const status = useApi((signal) => statusApi.get({ signal }), [], { refreshMs: 60_000 });
  const s = status.data;
  if (status.error) return <p className="status-line">갱신 시각을 받지 못했어요.</p>;
  if (!s) return <div className="skeleton sk-line" style={{ width: 240 }} />;
  const failed = s.lastRun?.status === 'FAILED';
  return (
    <p className="status-line" aria-label="데이터 갱신 시각">
      <span>
        <Clock className="icon-sm" aria-hidden="true" />
        뉴스 수집 {s.newsCollectedAt ? relativeTime(s.newsCollectedAt) : '아직 없음'}
      </span>
      <span>종목 요약 {s.summaryGeneratedAt ? relativeTime(s.summaryGeneratedAt) : '아직 없음'}</span>
      {failed && <span style={{ color: 'var(--danger)' }}>마지막 수집이 실패했어요</span>}
    </p>
  );
}

export default function HomePage() {
  useTitle('');
  const issues = useApi((signal) => loadIssues(signal), []);
  const codes = (issues.data || []).map((i) => i.stockCode);
  const { quotes, loading: quoteLoading, disabled } = useQuotes(codes);
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">오늘 시장 한눈에</h1>
          <p className="page-sub num">{todayLabel()} · 어떤 종목이 왜 뉴스에 나왔는지 모았어요</p>
        </div>
        <DataStatus />
      </div>
      <div className="grid-2">
        <div className="stack">
          <IssueList issues={issues} quotes={quotes} quoteLoading={quoteLoading} disabled={disabled} />
          <KeyNews />
        </div>
        <div className="stack">
          <WatchNews />
          {issues.data && issues.data.length > 0 && (
            <Movers issues={issues.data} quotes={quotes} disabled={disabled} loading={quoteLoading} />
          )}
        </div>
      </div>
    </>
  );
}
