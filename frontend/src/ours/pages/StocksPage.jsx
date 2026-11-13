// 종목 메인: 종목 찾기 → 오늘의 이슈 순위(서버 집계) → 이슈 종목 중 많이 오른·내린 → 관심 종목
// v2: 종목마다 최근 20거래일 추세선(보일 때만, 한 번에 2개씩 부름)과 기사 수 막대
// 시장 필터는 넣지 않음: 이슈 순위 API 에 시장 칸이 없어 V7 처럼 거르면 틀린 결과(KOSDAQ 0건)가 나옴
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, LogIn, Star } from 'lucide-react';
import { stockApi } from '../../api';
import { useApi } from '../../hooks/useApi';
import { useSession } from '../app/session';
import { useQuotes } from '../lib/useQuotes';
import { useTitle } from '../lib/hooks';
import { dirClass, fmtPrice, fmtRate, shortTime } from '../lib/format';
import SearchBox from '../components/SearchBox';
import Movers from '../components/Movers';
import Sparkline from '../components/Sparkline';
import { Empty, ErrorBox, SkeletonRows } from '../components/ui';

const LIMIT = 30;

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
  const issues = useApi((signal) => stockApi.issues({ limit: LIMIT }, { signal }), []);
  const items = issues.data?.items || [];
  const { quotes, loading: quoteLoading, disabled } = useQuotes(items.map((i) => i.stockCode));
  const maxCount = Math.max(1, ...items.map((i) => i.articleCount));

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">종목</h1>
          <p className="page-sub hide-mobile">오늘 뉴스에 많이 나온 종목부터 보여 드려요.</p>
        </div>
      </div>
      <SearchBox
        mode="stock"
        label="종목 찾기"
        placeholder="종목 이름·코드·별칭 (예: 삼전, 005930)…"
        onPick={(s) => navigate(`/stocks/${s.stockCode}`)}
      />
      <div className="grid-2 sl-grid" style={{ marginTop: 16 }}>
        <section className="card sl-rank" aria-labelledby="rank-title">
          <div className="card-head">
            <h2 className="card-title" id="rank-title">
              오늘의 이슈 순위
            </h2>
            <span className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
              오늘 0시부터 뉴스 기사 수
            </span>
          </div>
          {issues.loading && !issues.data && <SkeletonRows rows={8} compact />}
          {issues.error && <ErrorBox error={issues.error} onRetry={issues.reload} />}
          {issues.data && items.length === 0 && <Empty title="오늘 기사에 나온 종목이 아직 없어요" />}
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
                    <th scope="col" className="r hide-mobile">
                      소식
                    </th>
                    {!disabled && (
                      <th scope="col" className="r">
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
                  {items.map((it) => {
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
                        {!disabled && <td className="r">{q ? fmtPrice(q.price) : quoteLoading ? '' : '–'}</td>}
                        {!disabled && <td className={`r change ${dirClass(q?.changeRate)}`}>{q ? fmtRate(q.changeRate) : ''}</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {items.length > 0 && (
            <p className="card-note">소식은 같은 내용을 여러 언론사가 쓴 것을 한 번으로 센 수예요. 공시는 순위에 넣지 않고 따로 표시해요.</p>
          )}
        </section>
        {/* 휴대폰에선 등락을 순위표(30줄) 위로 (11/13 사용자 눈으로: '오늘 많이 내린 종목'을 찾다가 표 밑에 있어 못 찾음) */}
        <div className="stack sl-side">
          <div className="sl-movers">
            {items.length > 0 && <Movers issues={items} quotes={quotes} disabled={disabled} loading={quoteLoading} top={5} title={`이슈 종목 ${items.length}개 중 등락`} />}
          </div>
          <div className="sl-watch">
            <WatchMini />
          </div>
        </div>
      </div>
    </>
  );
}
