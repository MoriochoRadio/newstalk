// 통합 검색 결과 (/search?q=): 종목(이름·코드·별칭·테마) + 글(제목·요약·키워드, 서버 페이지)
// 종목 하나와 딱 맞으면(코드·이름이 같거나 결과가 1개) 그 종목에 연결된 글도 함께 → "005930" 으로 찾아도 뉴스가 보임
import { useSearchParams, Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { articleApi, searchApi, stockApi } from '../../api';
import { toUiArticle } from '../../api/adapters';
import { useApi } from '../../hooks/useApi';
import { useTitle } from '../lib/hooks';
import { StoryFeed } from '../components/ArticleRow';
import { Empty, ErrorBox, Pager, Segmented, SkeletonRows } from '../components/ui';

const SIZE = 10;
const PERIODS = [
  { key: '', label: '전체 기간' },
  { key: 'today', label: '오늘' },
  { key: '7d', label: '7일' },
  { key: '30d', label: '30일' },
];

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = (params.get('q') || '').trim();
  const period = params.get('period') || '';
  const page = Math.max(1, Number.parseInt(params.get('page') || '1', 10) || 1);
  useTitle(q ? `‘${q}’ 검색` : '검색');

  const set = (next) => {
    const p = new URLSearchParams(params);
    Object.entries(next).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)));
    setParams(p);
  };

  const res = useApi((signal) => searchApi.all(q, { period: period || undefined, page, size: SIZE }, { signal }), [q, period, page], {
    enabled: Boolean(q),
  });
  const stocks = useApi((signal) => stockApi.search(q, { size: 12 }, { signal }), [q], { enabled: Boolean(q) });

  const stockItems = stocks.data?.items || [];
  const sameTheme =
    stockItems.length > 1 && stockItems.every((s) => s.matchedTheme && s.matchedTheme === stockItems[0].matchedTheme) ? stockItems[0].matchedTheme : '';
  const top = stockItems[0];
  const exact = top && (top.stockCode === q.toUpperCase() || top.stockName === q || stocks.data.totalCount === 1) ? top : null;
  const linked = useApi((signal) => articleApi.list({ stockCode: exact.stockCode, size: 5 }, { signal }), [exact?.stockCode], {
    enabled: Boolean(exact),
  });

  if (!q) {
    return (
      <div className="card" style={{ marginTop: 16 }}>
        <Empty title="검색어를 입력해 주세요" desc="종목 이름·코드·별칭, 기사 제목의 낱말로 찾을 수 있어요." />
      </div>
    );
  }

  const articles = (res.data?.articles?.items || []).map(toUiArticle);
  const articleTotal = res.data?.articles?.totalCount ?? 0;

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">‘{q}’ 검색 결과</h1>
      </div>

      <section className="card" aria-labelledby="sr-stocks">
        <div className="card-head">
          <h2 className="card-title" id="sr-stocks">
            종목 {stocks.data && <span className="count num">{stocks.data.totalCount}</span>}
          </h2>
          {sameTheme && <span className="muted" style={{ fontSize: 'var(--fs-xs)' }}>테마 ‘{sameTheme}’ 종목</span>}
        </div>
        {stocks.loading && !stocks.data && <SkeletonRows rows={2} compact />}
        {stocks.error && <ErrorBox error={stocks.error} onRetry={stocks.reload} />}
        {stocks.data && stockItems.length === 0 && <p className="sub">맞는 종목이 없어요.</p>}
        {stockItems.length > 0 && (
          <div className="tags">
            {stockItems.map((s) => (
              <Link key={s.stockCode} to={`/stocks/${s.stockCode}`} className="chip">
                {s.stockName}
                {/* 모두 같은 테마면 테마는 위에 한 번만 → 칩이 짧아져 휴대폰에서 한 줄에 여럿 (11/13: 칩 12개가 한 줄씩 차지해 기사가 한참 아래) */}
                <span className="role num">
                  {s.stockCode}
                  {s.matchedTheme && !sameTheme ? ` · 테마 ${s.matchedTheme}` : ''}
                </span>
              </Link>
            ))}
            {stocks.data.totalCount > stockItems.length && <span className="chip-more">외 {stocks.data.totalCount - stockItems.length}종목</span>}
          </div>
        )}
      </section>

      {exact && (
        <section className="card" aria-labelledby="sr-linked">
          <div className="card-head">
            <h2 className="card-title" id="sr-linked">
              {exact.stockName} 소식 {linked.data && <span className="count num">{linked.data.totalCount.toLocaleString('ko-KR')}건</span>}
            </h2>
            <Link to={`/stocks/${exact.stockCode}`} className="link">
              종목 화면 <ChevronRight className="icon-sm" aria-hidden="true" />
            </Link>
          </div>
          {linked.loading && !linked.data && <SkeletonRows rows={3} />}
          {linked.data && (
            <StoryFeed articles={(linked.data.items || []).map(toUiArticle)} focusCode={exact.stockCode} />
          )}
        </section>
      )}

      <section className="card" aria-labelledby="sr-articles">
        <div className="card-head">
          <h2 className="card-title" id="sr-articles">
            ‘{q}’가 들어간 글 {res.data && <span className="count num">{articleTotal.toLocaleString('ko-KR')}건</span>}
          </h2>
          <Segmented label="기간" size="sm" options={PERIODS} value={period} onChange={(k) => set({ period: k, page: '' })} />
        </div>
        {res.loading && !res.data && <SkeletonRows rows={4} />}
        {res.error && <ErrorBox error={res.error} onRetry={res.reload} />}
        {res.data && articles.length === 0 && <p className="sub">제목·요약·키워드에 ‘{q}’가 들어간 글이 없어요.</p>}
        {articles.length > 0 && (
          <StoryFeed articles={articles} style={{ opacity: res.loading ? 0.5 : 1 }} />
        )}
        {res.data && <Pager page={page} size={SIZE} total={articleTotal} onChange={(n) => set({ page: n > 1 ? String(n) : '' })} />}
      </section>
    </>
  );
}
