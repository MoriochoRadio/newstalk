// 뉴스·공시 피드. 조건은 주소(?tab=&q=&period=&sort=&page=)에 둬서 뒤로 가기·새로고침·공유가 됨
// - 전체: 서버 페이지(page·size)와 totalCount 그대로
// - 뉴스·공시 탭: 백엔드 /api/articles 에 공시(channel) 조건이 없음 → 서버 페이지(100건씩)를 차례로 받아 거르고 "더 보기".
//   이 탭은 총 건수를 알 수 없어 숫자를 보여 주지 않음 (받아 온 범위로 총 건수를 지어내지 않음)
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { articleApi } from '../../api';
import { toUiArticle } from '../../api/adapters';
import { useApi } from '../../hooks/useApi';
import { useTitle } from '../lib/hooks';
import { StoryFeed } from '../components/ArticleRow';
import { Empty, ErrorBox, Pager, Segmented, SkeletonRows } from '../components/ui';
import { iGa } from '../lib/josa';

const PAGE_SIZE = 20;
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
function useFilteredFeed({ tab, q, period, sort }) {
  const [state, setState] = useState({ key: '', items: [], nextPage: 1, done: false, loading: false, error: null });
  const key = `${tab}|${q}|${period}|${sort}`;
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
      const wanted = items.length + PAGE_SIZE;
      for (let n = 0; n < 5 && items.length < wanted; n += 1) {
        const res = await articleApi.list(
          { source: 'NEWS', q: q || undefined, period: period || undefined, sort, page: nextPage, size: 100 },
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
    (signal) => articleApi.list({ q: q || undefined, period: period || undefined, sort, page, size: PAGE_SIZE }, { signal }),
    [q, period, sort, page],
    { enabled: tab === 'all' }
  );
  const filtered = useFilteredFeed({ tab, q, period, sort });

  const isAll = tab === 'all';
  const items = isAll ? (all.data?.items || []).map(toUiArticle) : filtered.fresh ? filtered.items : [];
  const loading = isAll ? all.loading : filtered.loading || !filtered.fresh;
  const error = isAll ? all.error : filtered.error;
  const total = all.data?.totalCount ?? 0;

  const [newCount, clearNew] = useNewArrivals(isAll && page === 1 && sort === 'latest' && !q, items[0]?.publishedAtIso, period);
  const showNew = () => {
    clearNew();
    all.reload();
    window.scrollTo({ top: 0 });
  };

  const goPage = (n) => {
    update({ page: n > 1 ? String(n) : '' });
    window.scrollTo(0, 0);
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
            {/* 공시는 관련도 점수가 없음(회사가 낸 자기 서류, docs/api.md) → 공시 탭에선 정렬을 감춤 (11/13 사용자 눈으로) */}
            {tab !== 'disclosure' && (
              <Segmented label="정렬" size="sm" options={SORTS} value={sort} onChange={(k) => update({ sort: k === 'latest' ? '' : k })} />
            )}
          </div>
        </div>

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
            title={q ? `‘${q}’${iGa(q)} 들어간 ${tab === 'disclosure' ? '공시가' : '글이'} 없어요` : '조건에 맞는 글이 없어요'}
            desc={period ? '기간을 넓혀 보세요.' : undefined}
            action={
              q || period ? (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => update({ q: '', period: '' })}>
                  조건 지우기
                </button>
              ) : null
            }
          />
        )}
        {items.length > 0 && (
          <StoryFeed articles={items} style={{ opacity: isAll && all.loading ? 0.5 : 1 }} />
        )}

        {isAll && all.data && (
          <>
            <Pager page={page} size={PAGE_SIZE} total={total} onChange={goPage} />
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
