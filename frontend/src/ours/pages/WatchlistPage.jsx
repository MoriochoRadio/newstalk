// 관심 종목: 표(종목·현재가·등락·오늘 기사·최근 기사·빼기) + 종목 담기 + 관심 종목 소식(서버 페이지)
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { LogIn, Plus, Star, X } from 'lucide-react';
import { stockApi, watchlistApi } from '../../api';
import { toUiArticle } from '../../api/adapters';
import { useApi } from '../../hooks/useApi';
import { useSession } from '../app/session';
import { useQuotes } from '../lib/useQuotes';
import { useTitle } from '../lib/hooks';
import { dirClass, fmtPrice, fmtRate, marketKo, relativeTime } from '../lib/format';
import SearchBox from '../components/SearchBox';
import { StoryFeed } from '../components/ArticleRow';
import { Empty, ErrorBox, Pager, SkeletonRows } from '../components/ui';
import { ToneRing, leanOf } from '../components/Tone';

const NEWS_SIZE = 10;

function WatchNews({ count }) {
  const { watchCodes } = useSession();
  const [page, setPage] = useState(1);
  const list = useApi((signal) => watchlistApi.articles({ page, size: NEWS_SIZE }, { signal }), [page, count]);
  const items = (list.data?.items || []).map(toUiArticle);
  return (
    <section className="card" aria-labelledby="wn-title" id="watch-news">
      <div className="card-head">
        <h2 className="card-title" id="wn-title">
          관심 종목 소식 {list.data && <span className="count num">전체 기간 {list.data.totalCount.toLocaleString('ko-KR')}건</span>}
        </h2>
      </div>
      {list.loading && !list.data && <SkeletonRows rows={4} />}
      {list.error && <ErrorBox error={list.error} onRetry={list.reload} />}
      {list.data && items.length === 0 && <Empty title="관심 종목과 연결된 글이 아직 없어요" />}
      {items.length > 0 && (
        <StoryFeed articles={items} toneCodes={watchCodes} style={{ opacity: list.loading ? 0.5 : 1 }} />
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

/** 담은 종목마다 오늘 좋은·나쁜 소식 수 (종목 요약 API 의 감성 수). 11/13 페르소나 준호: 표에 기사 수만 있어
 *  '내 종목 오늘 괜찮나?'를 알려면 아래 기사를 하나씩 읽어야 했음 → 기사 수 옆에 링 */
function useWatchTones(codes) {
  const [tones, setTones] = useState({});
  const key = codes.join(',');
  useEffect(() => {
    if (!key) return undefined;
    const controller = new AbortController();
    key.split(',').forEach((code) => {
      stockApi
        .summary(code, {}, { signal: controller.signal })
        .then((s) => setTones((prev) => ({ ...prev, [code]: s?.sentiment || null })))
        .catch(() => {});
    });
    return () => controller.abort();
  }, [key]);
  return tones;
}

/** 빈 관심 종목에서 바로 담기: 오늘 기사가 많은 종목 6개 (11/13 페르소나 수아: 주식 초보는 무엇을 담을지도 모름) */
function QuickPicks({ onPick }) {
  const issues = useApi((signal) => stockApi.issues({ limit: 6 }, { signal }), []);
  const items = issues.data?.items || [];
  if (!items.length) return null;
  return (
    <div className="quick-picks">
      <p className="link-label" style={{ marginTop: 0 }}>
        오늘 기사가 많은 종목
      </p>
      <div className="tags">
        {items.map((s) => (
          <button key={s.stockCode} type="button" className="chip" onClick={() => onPick(s)}>
            <Plus className="icon-sm" aria-hidden="true" />
            {s.stockName}
            <span className="sr-only"> 관심 종목에 담기</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function WatchTone({ t, count }) {
  const pos = t?.positiveCount || 0;
  const neg = t?.negativeCount || 0;
  const neu = t?.neutralCount || 0;
  if (!pos && !neg) return <span className="num">{count}건</span>;
  const lean = leanOf(pos, neu, neg);
  return (
    <span className="wl-tone num" title={`${lean.text} · 좋은 ${pos} · 나쁜 ${neg}${neu ? ` · 판단 없음 ${neu}` : ''}`}>
      {count}건
      {/* 글자 없는 링 → 글자 (11/16 3차 리뷰) → 글자 옆에 링 다시 (11/17 사용자) */}
      <ToneRing pos={pos} neu={neu} neg={neg} size={18} />
      {pos > 0 && <b className="good">좋은 소식 {pos}건</b>}
      {neg > 0 && <b className="bad">나쁜 소식 {neg}건</b>}
    </span>
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
  const tones = useWatchTones(items.map((w) => w.stockCode));

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
        {watchlist.loaded && items.length === 0 && (
          <>
            <Empty icon={Star} title="담은 종목이 없어요" desc="위 검색창에서 찾거나, 오늘 기사가 많은 종목을 눌러 바로 담아요." />
            <QuickPicks onPick={(s) => toggleWatch(s.stockCode, s.stockName)} />
          </>
        )}
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
                      <td className="r">
                        <WatchTone t={tones[w.stockCode]} count={w.todayArticleCount} />
                      </td>
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
