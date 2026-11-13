// 시장 지도 전용 화면 (11/13 피드백: "시장 지도는 차라리 더 키워서 따로 큰 화면으로")
// 오늘 기사가 많은 30종목: 칸 크기 = 오늘 기사 수, 색 = 어제 종가 대비 등락률 (빨강 오름·파랑 내림, 국내 관례)
// 색과 크기는 사실 두 개를 나란히 보여 줄 뿐 — 기사 때문에 움직였다는 뜻이 아님 (아래 안내)
import { useEffect, useState } from 'react';
import { stockApi } from '../../api';
import { useApi } from '../../hooks/useApi';
import { useQuotes } from '../lib/useQuotes';
import { useTitle } from '../lib/hooks';
import { todayLabel } from '../lib/format';
import { loadTodayFeed, pickWhy } from '../lib/todayFeed';
import MarketMap, { MapLegend } from '../components/MarketMap';
import Movers from '../components/Movers';
import { ErrorBox } from '../components/ui';

const LIMIT = 30;

/** 화면 높이에 맞춘 지도 높이 (위 머리줄·제목·범례를 빼고, 최소 420) */
function useMapHeight() {
  const calc = () => Math.max(420, Math.min(760, window.innerHeight - 230));
  const [h, setH] = useState(calc);
  useEffect(() => {
    const on = () => setH(calc());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return h;
}

export default function MapPage() {
  useTitle('시장 지도');
  const issues = useApi((signal) => stockApi.issues({ limit: LIMIT }, { signal }), []);
  const feed = useApi((signal) => loadTodayFeed(signal), []);
  const items = issues.data?.items || [];
  const { quotes, loading, disabled } = useQuotes(items.map((i) => i.stockCode));
  const height = useMapHeight();
  const tiles = items.map((it) => ({
    code: it.stockCode,
    name: it.stockName,
    articleCount: it.articleCount,
    eventCount: it.eventCount,
    disclosureCount: it.disclosureCount,
    rate: quotes[it.stockCode]?.changeRate ?? null,
    why: feed.data ? pickWhy(feed.data.items, it.stockCode) : null,
  }));

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow num">{todayLabel()}</p>
          <h1 className="page-title">시장 지도</h1>
        </div>
      </div>
      <section className="card map-page" aria-label={`오늘 기사가 많은 ${items.length || LIMIT}종목 지도`}>
        {issues.error && <ErrorBox error={issues.error} onRetry={issues.reload} />}
        {issues.loading && !issues.data && <div className="skeleton" style={{ height, borderRadius: 'var(--radius)' }} />}
        {items.length > 0 && <MarketMap tiles={tiles} priceReady={!disabled && !loading} height={height} />}
        {items.length > 0 && <MapLegend priceReady={!disabled} />}
      </section>
      <div style={{ marginTop: 16 }}>
        <Movers issues={items} quotes={quotes} disabled={disabled} loading={loading} top={5} title={`${items.length || LIMIT}종목 중 많이 오른·내린`} />
      </div>
      <p className="home-foot">칸 크기는 오늘 기사 수, 색은 어제 종가와 비교한 지금 등락률이에요. 기사와 주가의 관계를 뜻하지 않아요.</p>
    </>
  );
}
