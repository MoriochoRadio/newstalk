// 관심 종목: 표(종목·현재가·등락·오늘 기사·최근 기사·빼기) + 종목 담기 + 관심 종목 소식(서버 페이지)
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { LogIn, Star, X } from 'lucide-react';
import { watchlistApi } from '../../api';
import { toUiArticle } from '../../api/adapters';
import { useApi } from '../../hooks/useApi';
import { useSession } from '../app/session';
import { useQuotes } from '../lib/useQuotes';
import { useTitle } from '../lib/hooks';
import { dirClass, fmtPrice, fmtRate, marketKo, relativeTime } from '../lib/format';
import SearchBox from '../components/SearchBox';
import { StoryFeed } from '../components/ArticleRow';
import { Empty, ErrorBox, Pager, SkeletonRows } from '../components/ui';

const NEWS_SIZE = 10;

function WatchNews({ count }) {
  const [page, setPage] = useState(1);
  const list = useApi((signal) => watchlistApi.articles({ page, size: NEWS_SIZE }, { signal }), [page, count]);
  const items = (list.data?.items || []).map(toUiArticle);
  return (
    <section className="card" aria-labelledby="wn-title" id="watch-news">
      <div className="card-head">
        <h2 className="card-title" id="wn-title">
          관심 종목 소식 {list.data && <span className="count num">{list.data.totalCount.toLocaleString('ko-KR')}건</span>}
        </h2>
      </div>
      {list.loading && !list.data && <SkeletonRows rows={4} />}
      {list.error && <ErrorBox error={list.error} onRetry={list.reload} />}
      {list.data && items.length === 0 && <Empty title="관심 종목과 연결된 글이 아직 없어요" />}
      {items.length > 0 && (
        <StoryFeed articles={items} style={{ opacity: list.loading ? 0.5 : 1 }} />
      )}
      {list.data && (
        <Pager
          page={page}
          size={NEWS_SIZE}
          total={list.data.totalCount}
          onChange={(n) => {
            setPage(n);
            document.getElementById('watch-news')?.scrollIntoView({ block: 'start' });
          }}
        />
      )}
    </section>
  );
}

export default function WatchlistPage() {
  useTitle('관심 종목');
  const { user, checking, openAuth, watchlist, watchCodes, toggleWatch, reloadWatchlist } = useSession();
  const items = watchlist.items;
  const titleRef = useRef(null);
  // 빼기 뒤 포커스: 줄이 사라져도 맨 위로 떨어지지 않게 다음 줄(없으면 앞 줄, 그것도 없으면 제목)의 빼기 버튼으로 (11/12 점검)
  const removeAt = async (i) => {
    const next = items[i + 1] || items[i - 1];
    await toggleWatch(items[i].stockCode, items[i].stockName);
    const btn = next && document.querySelector(`[data-remove="${next.stockCode}"]`);
    if (btn) btn.focus();
    else titleRef.current?.focus();
  };
  const { quotes, loading: quoteLoading, disabled } = useQuotes(items.map((w) => w.stockCode));

  if (checking) {
    return (
      <div className="card" style={{ marginTop: 16 }}>
        <SkeletonRows rows={3} />
      </div>
    );
  }
  if (!user) {
    return (
      <>
        <div className="page-head">
          <h1 className="page-title">관심 종목</h1>
        </div>
        <div className="card">
          <Empty
            icon={Star}
            title="로그인하면 관심 종목을 담을 수 있어요"
            desc="담은 종목의 오늘 기사 수와 새 소식을 모아 보여 드려요."
            action={
              <button type="button" className="btn btn-primary" onClick={() => openAuth('login')}>
                <LogIn className="icon-sm" aria-hidden="true" />
                로그인
              </button>
            }
          />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title" ref={titleRef} tabIndex={-1}>
            관심 종목
          </h1>
          <p className="page-sub num">{items.length}개 종목</p>
        </div>
      </div>
      <SearchBox
        mode="stock"
        label="관심 종목 담기"
        placeholder="담을 종목 찾기 (이름·코드·별칭)…"
        onPick={(s) => {
          if (!watchCodes.has(s.stockCode)) toggleWatch(s.stockCode, s.stockName);
        }}
      />
      <section className="card" style={{ marginTop: 16 }} aria-labelledby="wl-title">
        <h2 className="sr-only" id="wl-title">
          담은 종목
        </h2>
        {watchlist.error && <ErrorBox error={watchlist.error} onRetry={reloadWatchlist} />}
        {!watchlist.loaded && <SkeletonRows rows={3} compact />}
        {watchlist.loaded && items.length === 0 && <Empty icon={Star} title="담은 종목이 없어요" desc="위 검색창에서 종목을 찾아 담아요." />}
        {items.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">종목</th>
                  {!disabled && (
                    <th scope="col" className="r">
                      현재가
                    </th>
                  )}
                  <th scope="col" className="r">
                    오늘 기사
                  </th>
                  <th scope="col" className="r hide-mobile">
                    최근 기사
                  </th>
                  <th scope="col" className="r">
                    <span className="sr-only">빼기</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((w, i) => {
                  const q = quotes[w.stockCode];
                  return (
                    <tr key={w.stockCode}>
                      <td>
                        <Link to={`/stocks/${w.stockCode}`} style={{ fontWeight: 600 }}>
                          {w.stockName}
                        </Link>
                        <div className="muted num" style={{ fontSize: 'var(--fs-xs)' }}>
                          {w.stockCode}
                          {w.market ? ` · ${marketKo(w.market)}` : ''}
                        </div>
                      </td>
                      {!disabled && (
                        <td className="r">
                          {q ? (
                            <>
                              <div>{fmtPrice(q.price)}</div>
                              <div className={`change ${dirClass(q.changeRate)}`} style={{ fontSize: 'var(--fs-sm)' }}>
                                {fmtRate(q.changeRate)}
                              </div>
                            </>
                          ) : quoteLoading ? (
                            <span className="skeleton" style={{ display: 'inline-block', width: 60, height: 14 }} />
                          ) : (
                            '–'
                          )}
                        </td>
                      )}
                      <td className="r">{w.todayArticleCount}건</td>
                      <td className="r hide-mobile muted">{w.lastMatchedAt ? relativeTime(w.lastMatchedAt) : '없음'}</td>
                      <td className="r">
                        <button type="button" className="icon-btn" aria-label={`${w.stockName} 관심 종목에서 빼기`} title="관심 종목에서 빼기" data-remove={w.stockCode} onClick={() => removeAt(i)}>
                          <X className="icon-sm" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {items.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <WatchNews count={items.length} />
        </div>
      )}
    </>
  );
}
