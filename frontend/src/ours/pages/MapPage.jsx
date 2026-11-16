// 시장 지도 전용 화면 (11/13 피드백: "시장 지도는 차라리 더 키워서 따로 큰 화면으로")
// 오늘 기사가 많은 30종목: 칸 크기 = 오늘 기사 수, 색 = 어제 종가 대비 등락률 (빨강 오름·파랑 내림, 국내 관례)
// 색과 크기는 사실 두 개를 나란히 보여 줄 뿐 — 기사 때문에 움직였다는 뜻이 아님 (아래 안내)
import { useEffect, useState } from 'react';
import { quoteApi, stockApi } from '../../api';
import { useApi } from '../../hooks/useApi';
import { useQuotes } from '../lib/useQuotes';
import { useTitle } from '../lib/hooks';
import { todayLabel } from '../lib/format';
import { loadTodayFeed, pickWhy } from '../lib/todayFeed';
import MarketMap, { MapLegend } from '../components/MarketMap';
import Movers from '../components/Movers';
import { Empty, ErrorBox, Segmented, limitOf } from '../components/ui';
import CapMap, { CapLegend } from '../components/CapMap';
import { Link } from 'react-router-dom';
import { LayoutGrid } from 'lucide-react';

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
  // 지도 두 가지 (11/16 저녁): 시가총액 지도(FINVIZ 방식, 코스피·코스닥 시총 상위) / 오늘 기사 많은 종목 지도. 서버가 시총 지도를 모르면 기사 지도만
  const [mode, setMode] = useState('cap');
  const capMap = useApi((signal) => quoteApi.marketMap({ signal }), []);
  const capReady = Boolean(capMap.data?.items?.length);
  const showCap = mode === 'cap' && capReady;
  const capNews = {};
  if (feed.data && capReady) {
    const news = feed.data.items.filter((a) => !a.isDisclosure);
    capMap.data.items.forEach((it) => {
      const n = news.filter((a) => a.relatedStocks.some((s) => s.code === it.stockCode)).length;
      if (n) capNews[it.stockCode] = { count: n, top: pickWhy(news, it.stockCode) };
    });
  }
  // 칸마다 대표 제목: 같은 기사가 두 칸에 나오면 뒤 칸은 그 종목의 다른 기사로 (11/16 리뷰 14번: 삼성전자·SK하이닉스 칸 제목이 같았음)
  const usedWhy = new Set();
  const whyOf = (code) => {
    if (!feed.data) return null;
    const pick = pickWhy(feed.data.items.filter((a) => !usedWhy.has(a.id)), code);
    if (pick) usedWhy.add(pick.id);
    return pick;
  };
  const tiles = items.map((it) => ({
    code: it.stockCode,
    name: it.stockName,
    articleCount: it.articleCount,
    eventCount: it.eventCount,
    disclosureCount: it.disclosureCount,
    rate: quotes[it.stockCode]?.changeRate ?? null,
    limit: limitOf(quotes[it.stockCode]),
    why: whyOf(it.stockCode),
  }));

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">
            시장 지도 <span className="title-date num">{todayLabel()}</span>
          </h1>
          <p className="page-sub">
            {showCap
              ? '코스피·코스닥 시가총액 상위 · 크기 = 시가총액 · 색 = 오늘 등락률 · 칸 안 = 오늘 기사 수'
              : '오늘 기사가 많은 종목 · 크기 = 그 종목 오늘 기사 전부(여러 소식의 합) · 색 = 오늘 등락률'}
          </p>
        </div>
        {capReady && (
          <Segmented
            label="지도 고르기"
            size="sm"
            options={[
              { key: 'cap', label: '시가총액' },
              { key: 'news', label: '기사 많은 종목' },
            ]}
            value={mode}
            onChange={setMode}
          />
        )}
      </div>
      <section className="card map-page" aria-label={`오늘 기사가 많은 ${items.length || LIMIT}종목 지도`}>
        {issues.error && <ErrorBox error={issues.error} onRetry={issues.reload} />}
        {issues.loading && !issues.data && <div className="skeleton" style={{ height, borderRadius: 'var(--radius)' }} />}
        {showCap && (
          <>
            <CapMap items={capMap.data.items} news={capNews} height={height} maxShare={0.14} />
            <CapLegend />
          </>
        )}
        {!showCap && items.length > 0 && <MarketMap tiles={tiles} priceReady={!disabled && !loading} height={height} />}
        {!showCap && items.length > 0 && <MapLegend priceReady={!disabled} />}
        {/* 오늘 기사에 나온 종목이 없을 때(자정 직후·수집 멈춤): 빈 칸 대신 (11/16 QA) */}
        {issues.data && items.length === 0 && (
          <Empty
            icon={LayoutGrid}
            title="오늘 기사에 나온 종목이 아직 없어요"
            action={
              <Link to="/news?period=7d" className="btn btn-primary btn-sm">
                최근 7일 소식
              </Link>
            }
          />
        )}
      </section>
      {/* 종목이 있을 때만: 실패·0개일 때 "오른 종목이 없어요"가 같이 나와 헷갈렸음 */}
      {items.length > 0 && (
        <>
          <div style={{ marginTop: 16 }}>
            <Movers issues={items} quotes={quotes} disabled={disabled} loading={loading} top={5} title={`${items.length}종목 중 많이 오른·내린`} />
          </div>
        </>
      )}
    </>
  );
}
