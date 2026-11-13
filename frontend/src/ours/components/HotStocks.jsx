// 오늘 화제 종목 카드 (AI 종합 요약·소식 종류·기사/언론 수·평소 대비 보도량·첫 기사 시각)
// 11/13 피드백 "홈은 한 화면 대시보드, 나머지는 눌러서 다른 화면" → 홈에서 빼서 종목 화면으로. 필요한 데이터를 스스로 부름
import { useEffect, useState } from 'react';
import { stockApi } from '../../api';
import { useApi } from '../../hooks/useApi';
import { loadTodayFeed } from '../lib/todayFeed';
import { stockDigest } from '../lib/digest';
import { buzzOf } from '../lib/buzz';
import BriefCard from './BriefCard';
import { Empty, ErrorBox, SkeletonRows } from './ui';

/** 종목 여러 개에 같은 API 를 한 번씩. code → 값 | null(실패), 아직이면 키 없음 */
export function usePerStock(codes, fetcher, tag) {
  const key = codes.join(',');
  const [map, setMap] = useState({});
  useEffect(() => {
    if (!key) return undefined;
    const controller = new AbortController();
    key.split(',').forEach((code) => {
      fetcher(code, controller.signal)
        .then((v) => setMap((m) => ({ ...m, [code]: v })))
        .catch((err) => {
          if (err.name !== 'AbortError') setMap((m) => ({ ...m, [code]: null }));
        });
    });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tag]);
  return map;
}

export default function HotStocks({ issues, quotes, quoteLoading, priceOff, n = 4 }) {
  const feed = useApi((signal) => loadTodayFeed(signal), []);
  const items = (issues.data?.items || []).slice(0, n);
  const codes = items.map((i) => i.stockCode);
  const summaries = usePerStock(codes, (code, signal) => stockApi.summary(code, {}, { signal }), 'summary');
  const buzz = usePerStock(codes, (code, signal) => stockApi.mentions(code, '7d', { signal }), 'mentions');

  if (issues.loading && !issues.data) {
    return (
      <div className="brief-grid">
        {Array.from({ length: n }, (_, i) => (
          <div key={i} className="brief">
            <SkeletonRows rows={2} compact />
          </div>
        ))}
      </div>
    );
  }
  if (issues.error) return <ErrorBox error={issues.error} onRetry={issues.reload} />;
  if (items.length === 0) {
    return (
      <div className="card">
        <Empty title="오늘 기사에 나온 종목이 아직 없어요" desc="자정이 막 지났다면 첫 기사가 모이는 중이에요." />
      </div>
    );
  }
  const feedItems = feed.data?.items || [];
  return (
    <div className="brief-grid">
      {items.map((it) => {
        const first = feedItems.filter((a) => a.relatedStocks.some((s) => s.code === it.stockCode)).at(-1);
        return (
          <BriefCard
            key={it.stockCode}
            rank={it.rank}
            code={it.stockCode}
            name={it.stockName}
            quote={quotes[it.stockCode]}
            quoteLoading={quoteLoading}
            priceOff={priceOff}
            summary={summaries[it.stockCode] === undefined ? undefined : summaries[it.stockCode]}
            digest={feed.data ? stockDigest(feedItems, it.stockCode) : null}
            buzz={buzz[it.stockCode] ? buzzOf(buzz[it.stockCode]) : null}
            firstAt={feed.data?.complete ? first?.publishedAtIso : null}
            articleCount={it.articleCount}
          />
        );
      })}
    </div>
  );
}
