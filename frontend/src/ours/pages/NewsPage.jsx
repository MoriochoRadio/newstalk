// 뉴스·공시 피드. 조건은 주소(?tab=&q=&period=&sort=&page=)에 둬서 뒤로 가기·새로고침·공유가 됨
// - 전체: 서버 페이지(page·size)와 totalCount 그대로
// - 뉴스·공시 탭: 백엔드 /api/articles 에 공시(channel) 조건이 없음 → 서버 페이지(100건씩)를 차례로 받아 거르고 "더 보기".
//   이 탭은 총 건수를 알 수 없어 숫자를 보여 주지 않음 (받아 온 범위로 총 건수를 지어내지 않음)
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LayoutList, Rows3, Search, X } from 'lucide-react';
import { articleApi } from '../../api';
import { toUiArticle } from '../../api/adapters';
import { useApi } from '../../hooks/useApi';
import { useTitle } from '../lib/hooks';
import { StoryFeed } from '../components/ArticleRow';
import { Empty, ErrorBox, Pager, Segmented, SkeletonRows } from '../components/ui';
import { iGa } from '../lib/josa';
import CategoryBar from '../components/CategoryBar';
import { useProMode } from '../lib/proMode';

const PAGE_SIZE = 20;
const DENSE_SIZE = 50; // 작게 보기는 한 쪽에 50개 (11/18 사용자: 한눈에 여러 개)
// 보기 방식(크게·작게)은 이 브라우저에 기억 (주소에 두지 않음: 공유한 사람의 보기 방식까지 따라가면 이상함)
const VIEW_KEY = 'snm_news_view';
function readView() {
  try {
    return localStorage.getItem(VIEW_KEY) === 'dense' ? 'dense' : 'card';
  } catch {
    return 'card';
  }
}
const VIEWS = [
  { key: 'card', label: '크게', icon: LayoutList },
  { key: 'dense', label: '작게', icon: Rows3 },
];
const TABS = [
  { key: 'all', label: '전체' },
  { key: 'news', label: '뉴스' },
  { key: 'disclosure', label: '공시' },
];
// 기본 = 오늘 (11/16 밤 디자이너: '전체 기간·최신순'이면 첫 화면이 상장폐지·거래정지 공시). 검색어가 있으면 기본 = 전체 기간
const PERIODS = [
  { key: 'all', label: '전체 기간' },
  { key: 'today', label: '오늘' },
  { key: '7d', label: '7일' },
  { key: '30d', label: '30일' },
];
const SORTS = [
  { key: 'latest', label: '최신순' },
  { key: 'relevance', label: '관련도순' },
];

/** 뉴스·공시 탭: 서버에서 100건씩 받아 그 탭 글만 모음 (한 번 누를 때 최대 5번 요청) */
function useFilteredFeed({ tab, q, period, sort, market, theme, size }) {
  const [state, setState] = useState({ key: '', items: [], nextPage: 1, done: false, loading: false, error: null });
  const key = `${tab}|${q}|${period}|${sort}|${market}|${theme}|${size}`;
  const abortRef = useRef(null);

  const load = (reset) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const start = reset ? { key, items: [], nextPage: 1, done: false } : state;
    setState({ ...start, key, loading: true, error: null });
    (async () => {
      let { items, nextPage } = start;
      let done = false;
      const wanted = items.length + size;
      for (let n = 0; n < 5 && items.length < wanted; n += 1) {
        const res = await articleApi.list(
          { source: 'NEWS', q: q || undefined, period: period || undefined, sort, market: market || undefined, theme: theme || undefined, page: nextPage, size: 100 },
          { signal: controller.signal }
        );
        const got = (res?.items || []).map(toUiArticle);
        items = [...items, ...got.filter((a) => (tab === 'disclosure' ? a.isDisclosure : !a.isDisclosure))];
        nextPage += 1;
        if (got.length < 100 || (nextPage - 1) * 100 >= (res?.totalCount ?? 0)) {
          done = true;
          break;
        }
      }
      setState({ key, items, nextPage, done, loading: false, error: null });
    })().catch((err) => {
      if (err.name !== 'AbortError') setState((s) => ({ ...s, loading: false, error: err }));
    });
  };

  useEffect(() => {
    if (tab === 'all') return undefined;
    load(true);
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { ...state, fresh: state.key === key, loadMore: () => load(false) };
}

/**
 * 새 소식 알림 (참고 조사 상위 5개 중 하나, 11/12): 목록 맨 위를 보고 있을 때 1분마다 첫 페이지를 다시 받아
 * 지금 보이는 맨 위 글보다 새로 나온 글 수를 셈. 목록을 저절로 밀어 넣지 않고(읽던 자리가 흔들리지 않게) 버튼으로 알림
 * 조건: 전체 탭·최신순·1페이지·검색어 없음, 화면이 보일 때만 (숨겨진 탭에서는 요청 안 함)
 */
const NEW_POLL_MS = 60000;
function useNewArrivals(enabled, topIso, period) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    setCount(0);
    if (!enabled || !topIso) return undefined;
    const top = new Date(topIso).getTime();
    const check = async () => {
      if (document.hidden) return;
      try {
        const res = await articleApi.list({ period: period || undefined, sort: 'latest', page: 1, size: PAGE_SIZE });
        setCount((res?.items || []).filter((x) => new Date(x.publishedAt).getTime() > top).length);
      } catch {
        /* 알림용이라 실패는 조용히 넘김 (다음 차례에 다시) */
      }
    };
    const id = setInterval(check, NEW_POLL_MS);
    return () => clearInterval(id);
  }, [enabled, topIso, period]);
  return [count, () => setCount(0)];
}

export default function NewsPage() {
  useTitle('뉴스·공시');
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'all';
  const q = params.get('q') || '';
  const periodParam = params.get('period');
  const periodKey = PERIODS.some((p) => p.key === periodParam) ? periodParam : q ? 'all' : 'today';
  const period = periodKey === 'all' ? '' : periodKey; // API 로 보내는 값 ('' = 전체)
  const defaultPeriod = q ? 'all' : 'today';
  const sort = params.get('sort') === 'relevance' && tab !== 'disclosure' ? 'relevance' : 'latest'; // 공시 탭은 늘 최신순
  const page = Math.max(1, Number.parseInt(params.get('page') || '1', 10) || 1);
  const market = ['KOSPI', 'KOSDAQ'].includes(params.get('market')) ? params.get('market') : '';
  const theme = (params.get('theme') || '').slice(0, 50);
  const [view, setView] = useState(readView);
  const [pro] = useProMode();
  const dense = pro || view === 'dense'; // 한눈에(전체 스위치)면 늘 작게
  const size = dense ? DENSE_SIZE : PAGE_SIZE;
  const changeView = (v) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* 기억 못 해도 지금 화면은 바뀜 */
    }
    if (page > 1) update({ page: '' }); // 한 쪽 크기가 바뀌면 쪽 번호가 다른 글을 가리킴 → 첫 쪽으로
  };
  const [draft, setDraft] = useState(q);
  const qRef = useRef(null);
  useEffect(() => setDraft(q), [q]);

  const update = (next) => {
    const p = new URLSearchParams(params);
    Object.entries(next).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)));
    if (!('page' in next)) p.delete('page');
    setParams(p);
  };

  const all = useApi(
    (signal) =>
      articleApi.list(
        { q: q || undefined, period: period || undefined, sort, market: market || undefined, theme: theme || undefined, page, size },
        { signal }
      ),
    [q, period, sort, page, market, theme, size],
    { enabled: tab === 'all' }
  );
  const filtered = useFilteredFeed({ tab, q, period, sort, market, theme, size });

  const isAll = tab === 'all';
  const items = isAll ? (all.data?.items || []).map(toUiArticle) : filtered.fresh ? filtered.items : [];
  const loading = isAll ? all.loading : filtered.loading || !filtered.fresh;
  const error = isAll ? all.error : filtered.error;
  const total = all.data?.totalCount ?? 0;

  // 새 소식 알림은 분류를 고르지 않았을 때만 (알림이 세는 '전체 최신 글'과 지금 목록이 달라짐)
  const [newCount, clearNew] = useNewArrivals(isAll && page === 1 && sort === 'latest' && !q && !market && !theme, items[0]?.publishedAtIso, period);
  const showNew = () => {
    clearNew();
    all.reload();
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const goPage = (n) => {
    update({ page: n > 1 ? String(n) : '' });
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); // smooth 스크롤이면 새 목록이 오는 동안 중간에서 멈춤
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">뉴스·공시</h1>
        </div>
      </div>

      <div className="card">
        <div className="toolbar">
          <Segmented label="종류" options={TABS} value={tab} onChange={(k) => update({ tab: k === 'all' ? '' : k })} />
          <form
            className="inline-search grow"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              update({ q: draft.trim() });
            }}
          >
            <Search className="icon-sm" aria-hidden="true" />
            <input
              ref={qRef}
              type="search"
              autoComplete="off"
              aria-label="제목·요약에서 찾기"
              placeholder="제목·요약·키워드에서 찾기"
              value={draft}
              maxLength={50}
              onChange={(e) => setDraft(e.target.value)}
            />
            {q && (
              <button type="button" className="icon-btn" style={{ width: 28, height: 28 }} aria-label="검색어 지우기" onClick={() => {
                update({ q: '' });
                qRef.current?.focus();
              }}>
                <X className="icon-sm" aria-hidden="true" />
              </button>
            )}
          </form>
        </div>
        <div className="toolbar" style={{ justifyContent: 'space-between' }}>
          <Segmented label="기간" size="sm" options={PERIODS} value={periodKey} onChange={(k) => update({ period: k === defaultPeriod ? '' : k })} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {isAll && all.data && (
              <span className="result-count num" aria-live="polite">
                총 {total.toLocaleString('ko-KR')}건
              </span>
            )}
            {!pro && (
            <div className="segmented sm view-toggle" role="group" aria-label="보기 방식">
              {VIEWS.map(({ key, label, icon: Icon }) => (
                <button key={key} type="button" aria-pressed={view === key} onClick={() => changeView(key)} title={key === 'dense' ? '한 줄씩 작게, 한 쪽에 50개' : '요약까지 크게'}>
                  <Icon className="icon-sm" aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
            )}
            {/* 공시는 관련도 점수가 없음(회사가 낸 자기 서류, docs/api.md) → 공시 탭에선 정렬을 감춤 (11/13 사용자 눈으로) */}
            {tab !== 'disclosure' && (
              <Segmented label="정렬" size="sm" options={SORTS} value={sort} onChange={(k) => update({ sort: k === 'latest' ? '' : k })} />
            )}
          </div>
        </div>

        <CategoryBar
          value={{ market, theme }}
          period={periodKey === 'all' ? '30d' : periodKey}
          countLabel={periodKey === 'today' ? '오늘 기사' : periodKey === '7d' ? '7일 기사' : '30일 기사'}
          onChange={(next) => update(next)}
        />

        {/* 새 소식 알림: 버튼이 나타날 때 낭독기에 한 번 알림 (aria-live), 누르면 목록을 새로 받음 */}
        <div aria-live="polite" className="new-arrivals-slot">
          {newCount > 0 && (
            <button type="button" className="new-arrivals" onClick={showNew}>
              <span className="new-dot" aria-hidden="true" />새 소식 {newCount >= PAGE_SIZE ? `${PAGE_SIZE}개 이상` : `${newCount}개`} 보기
            </button>
          )}
        </div>
        {error && <ErrorBox error={error} onRetry={isAll ? all.reload : filtered.loadMore} />}
        {loading && items.length === 0 && <SkeletonRows rows={6} />}
        {!loading && !error && items.length === 0 && !isAll && !filtered.done && (
          <Empty
            title="최근 글 500건 안에는 없어요"
            action={
              <button type="button" className="btn btn-secondary btn-sm" onClick={filtered.loadMore}>
                더 이전 글에서 찾기
              </button>
            }
          />
        )}
        {!loading && !error && items.length === 0 && (isAll || filtered.done) && (
          <Empty
            title={
              q
                ? `‘${q}’${iGa(q)} 들어간 ${tab === 'disclosure' ? '공시가' : '글이'} 없어요`
                : periodKey === 'today' && !market && !theme
                  ? `오늘 나온 ${tab === 'disclosure' ? '공시가' : '글이'} 아직 없어요`
                  : '조건에 맞는 글이 없어요'
            }
            desc={market || theme ? '고른 분류를 지우거나 기간을 넓혀 보세요.' : period ? '기간을 넓혀 보세요.' : undefined}
            action={
              // 기본값이 '오늘'이라 기간을 비우면 다시 오늘이 됨 → '전체 기간'을 주소에 넣음 (3차 코드 리뷰: 눌러도 그대로였음)
              q || period || market || theme ? (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => update({ q: '', period: 'all', market: '', theme: '' })}>
                  {q || market || theme ? '조건 지우기' : '전체 기간 보기'}
                </button>
              ) : null
            }
          />
        )}
        {/* '제목만 연결' 뜻을 목록 위에 한 번 (줄마다 긴 문구를 되풀이하지 않게, 휴대폰·키보드에서도 보이게 — 4차 리뷰) */}
        {items.some((x) => x.titleOnly) && (
          <p className="feed-note">
            <b>제목만 연결</b>{' '}
            {/* 휴대폰은 한 줄로 (긴 문장이 5줄이라 첫 화면의 3분의 1을 차지했음 — 11/17 점검). 이유는 줄의 '제목만 연결'에 설명으로 있음 */}
            <span className="feed-note-long">
              = 연합뉴스·서울경제·연합인포맥스처럼 기사에 'AI 학습 및 활용 금지'를 적은 언론사(또는 본문을 받지 못한 기사)는 요약·판단 없이 제목으로만 종목을 찾았어요.
            </span>
            <span className="feed-note-short">= AI 요약·판단 없이 제목으로 종목을 찾은 기사</span>
          </p>
        )}
        {items.length > 0 && (
          <StoryFeed articles={items} dense={dense} style={{ opacity: isAll && all.loading ? 0.5 : 1 }} />
        )}

        {isAll && all.data && (
          <>
            <Pager page={page} size={size} total={total} onChange={goPage} />
          </>
        )}
        {!isAll && filtered.fresh && items.length > 0 && (
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            {filtered.done ? (
              <p className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
                마지막 글이에요.
              </p>
            ) : (
              <button type="button" className="btn btn-secondary" onClick={filtered.loadMore} disabled={filtered.loading}>
                {filtered.loading ? '불러오는 중…' : '더 보기'}
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
