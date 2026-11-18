// 종목 메인: 종목 찾기 → 오늘의 이슈 순위(서버 집계) → 이슈 종목 중 많이 오른·내린 → 관심 종목
// v2: 종목마다 최근 20거래일 추세선(보일 때만, 한 번에 2개씩 부름)과 기사 수 막대
// 11/18: 분류별 보기(시장·업종·테마) — 이슈 순위 API 가 market·theme 로 걸러 줌 (백엔드 feature/be-account-category). 값은 주소에
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronRight, LayoutList, LogIn, Rows3, Star } from 'lucide-react';
import { stockApi } from '../../api';
import { useApi } from '../../hooks/useApi';
import { useSession } from '../app/session';
import { useQuotes } from '../lib/useQuotes';
import { useTitle } from '../lib/hooks';
import { dirClass, fmtPrice, fmtRate, shortTime } from '../lib/format';
import Movers from '../components/Movers';
import HotStocks from '../components/HotStocks';
import Sparkline from '../components/Sparkline';
import { Empty, ErrorBox, LimitBadge, SkeletonRows } from '../components/ui';
import CategoryBar, { MARKETS } from '../components/CategoryBar';

const LIMIT = 30;
// 11/18 실험(test/fe-dashboard-compact): 크게 = 화제 종목 카드 + 순위 15줄, 작게 = 카드 없이 순위 30줄을 촘촘히 (뉴스·공시의 크게·작게와 같은 단추)
const VIEW_KEY = 'snm_stocks_view';
const VIEWS = [
  { key: 'card', label: '크게', icon: LayoutList },
  { key: 'dense', label: '작게', icon: Rows3 },
];

function WatchMini() {
  const { user, checking, openAuth, watchlist } = useSession();
  return (
    <section className="card" aria-labelledby="mini-watch">
      <div className="card-head">
        <h2 className="card-title" id="mini-watch">
          <Star className="icon" aria-hidden="true" />
          관심 종목
        </h2>
        {user && (
          <Link to="/watchlist" className="link">
            전체 <ChevronRight className="icon-sm" aria-hidden="true" />
          </Link>
        )}
      </div>
      {checking && <SkeletonRows rows={2} compact />}
      {!checking && !user && (
        <Empty
          icon={Star}
          title="로그인하면 담은 종목이 여기 보여요"
          action={
            <button type="button" className="btn btn-primary btn-sm" onClick={() => openAuth('login')}>
              <LogIn className="icon-sm" aria-hidden="true" />
              로그인
            </button>
          }
        />
      )}
      {user && watchlist.loaded && watchlist.items.length === 0 && <p className="sub">아직 담은 종목이 없어요. 종목 화면의 별 버튼으로 담아요.</p>}
      {user && watchlist.items.length > 0 && (
        <ul>
          {watchlist.items.slice(0, 8).map((w) => (
            <li key={w.stockCode}>
              <Link to={`/stocks/${w.stockCode}`} className="mover">
                <span className="mover-name">{w.stockName}</span>
                <span className="muted num" style={{ fontSize: 'var(--fs-sm)', whiteSpace: 'nowrap' }}>
                  오늘 {w.todayArticleCount}건
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function StocksPage() {
  useTitle('종목');
  const navigate = useNavigate();
  // 줄 어디를 눌러도 종목 화면으로 (키보드는 줄 안의 종목 이름 링크). 글자를 고르는 중이면 이동 안 함, Ctrl·⌘·가운데 클릭은 새 탭
  const openRow = (e, code) => {
    if (window.getSelection?.().toString()) return;
    const path = `/stocks/${code}`;
    if (e.ctrlKey || e.metaKey || e.button === 1) window.open(path, '_blank', 'noopener');
    else navigate(path);
  };
  const [params, setParams] = useSearchParams();
  const market = ['KOSPI', 'KOSDAQ'].includes(params.get('market')) ? params.get('market') : '';
  const theme = (params.get('theme') || '').slice(0, 50);
  const filtering = Boolean(market || theme);
  const setCategory = (next) => {
    const p = new URLSearchParams(params);
    Object.entries(next).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)));
    setParams(p, { replace: true });
  };
  const issues = useApi((signal) => stockApi.issues({ limit: LIMIT, market, theme }, { signal }), [market, theme]);
  const catLabel = [MARKETS.find((m) => m.key === market && m.key)?.label, theme].filter(Boolean).join(' · ');
  const items = issues.data?.items || [];
  const { quotes, loading: quoteLoading, disabled } = useQuotes(items.map((i) => i.stockCode));
  const maxCount = Math.max(1, ...items.map((i) => i.articleCount));
  // 처음엔 15줄 + '더 보기' (11/16 리뷰 11번: 30줄이라 화면이 3,400px 넘게 길었음)
  const [showAll, setShowAll] = useState(false);
  const [view, setViewState] = useState(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === 'dense' ? 'dense' : 'card';
    } catch {
      return 'card';
    }
  });
  const setView = (v) => {
    setViewState(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* 기억 못 해도 지금 화면은 바뀜 */
    }
  };
  const dense = view === 'dense';
  const rows = showAll || dense ? items : items.slice(0, 15);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">종목</h1>
        </div>
        <div className="segmented sm view-toggle" role="group" aria-label="보기 방식">
          {VIEWS.map(({ key, label, icon: Icon }) => (
            <button key={key} type="button" aria-pressed={view === key} onClick={() => setView(key)}>
              <Icon className="icon-sm" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="card cat-card">
        <CategoryBar value={{ market, theme }} onChange={setCategory} />
      </div>
      {/* 화면 안 종목 검색창은 뺌: 바로 위 머리줄 검색과 같은 일이라 어느 쪽에 써야 할지 망설이게 함 (11/16 디자이너 리뷰) */}
      {/* 홈에서 옮겨 온 화제 종목 카드 (11/13 피드백: 홈은 한 화면 대시보드, 자세한 건 눌러서 다른 화면) */}
      {!dense && (
      <section className="hot-section" aria-labelledby="hot-title">
        <h2 className="section-title" id="hot-title">
          오늘 화제 종목{filtering && <span className="section-tag">{catLabel}</span>}
        </h2>
        <HotStocks issues={issues} quotes={quotes} quoteLoading={quoteLoading} priceOff={disabled} />
      </section>
      )}
      <div className={`grid-2 sl-grid ${dense ? 'sl-dense' : ''}`} style={{ marginTop: dense ? 0 : 16 }}>
        <section className="card sl-rank" aria-labelledby="rank-title">
          <div className="card-head">
            <h2 className="card-title" id="rank-title">
              오늘 화제 종목 순위
              {filtering && <span className="section-tag">{catLabel}</span>}
            </h2>
            <span className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
              오늘 0시부터 뉴스 기사 수
            </span>
          </div>
          {issues.loading && !issues.data && <SkeletonRows rows={8} compact />}
          {issues.error && <ErrorBox error={issues.error} onRetry={issues.reload} />}
          {issues.data && items.length === 0 && (
            <Empty
              title={filtering ? `오늘 기사에 나온 ${catLabel} 종목이 아직 없어요` : '오늘 기사에 나온 종목이 아직 없어요'}
              action={
                filtering ? (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setCategory({ market: '', theme: '' })}>
                    분류 지우기
                  </button>
                ) : null
              }
            />
          )}
          {items.length > 0 && (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col" style={{ width: 36 }}>
                      순위
                    </th>
                    <th scope="col">종목</th>
                    {!disabled && (
                      <th scope="col" className="hide-mobile">
                        20거래일
                      </th>
                    )}
                    <th scope="col" className="r">
                      기사
                    </th>
                    <th scope="col" className="r hide-mobile" title="같은 내용을 여러 언론사가 쓴 것을 한 번으로 센 수. 공시는 순위에 넣지 않고 따로 표시">
                      소식
                    </th>
                    {!disabled && (
                      <th scope="col" className="r hide-mobile">
                        현재가
                      </th>
                    )}
                    {!disabled && (
                      <th scope="col" className="r">
                        등락률
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((it) => {
                    const q = quotes[it.stockCode];
                    return (
                      <tr key={it.stockCode} onClick={(e) => openRow(e, it.stockCode)} style={{ cursor: 'pointer' }}>
                        <td className="rank">{it.rank}</td>
                        <td>
                          <Link to={`/stocks/${it.stockCode}`} style={{ fontWeight: 600 }} onClick={(e) => e.stopPropagation()}>
                            {it.stockName}
                          </Link>
                          {it.disclosureCount > 0 && (
                            <span className="badge badge-accent" style={{ marginLeft: 6 }}>
                              공시 {it.disclosureCount}
                            </span>
                          )}
                          <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
                            {it.stockCode}
                            {it.lastPublishedAt ? ` · 최근 ${shortTime(it.lastPublishedAt)}` : ''}
                          </div>
                        </td>
                        {!disabled && (
                          <td className="hide-mobile">
                            <Sparkline code={it.stockCode} name={it.stockName} />
                          </td>
                        )}
                        <td className="r">
                          <span className="count-cell">
                            <span className="count-bar" aria-hidden="true">
                              <span style={{ width: `${(it.articleCount / maxCount) * 100}%` }} />
                            </span>
                            {it.articleCount}
                          </span>
                        </td>
                        <td className="r hide-mobile">{it.eventCount ?? '–'}</td>
                        {!disabled && <td className="r hide-mobile">{q ? fmtPrice(q.price) : quoteLoading ? '' : '–'}</td>}
                        {!disabled && (
                          <td className={`r change ${dirClass(q?.changeRate)}`}>
                            {q ? fmtRate(q.changeRate) : ''}
                            {q && <LimitBadge quote={q} />}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {items.length > rows.length && (
            <button type="button" className="story-toggle" onClick={() => setShowAll(true)}>
              {items.length - rows.length}종목 더 보기
            </button>
          )}
        </section>
        {/* 휴대폰에선 등락을 순위표(30줄) 위로 (11/13 사용자 눈으로: '오늘 많이 내린 종목'을 찾다가 표 밑에 있어 못 찾음) */}
        <div className="stack sl-side">
          <div className="sl-movers">
            {items.length > 0 && <Movers issues={items} quotes={quotes} disabled={disabled} loading={quoteLoading} top={5} title={`화제 종목 ${items.length}개 중 등락`} />}
          </div>
          <div className="sl-watch">
            <WatchMini />
          </div>
        </div>
      </div>
    </>
  );
}
