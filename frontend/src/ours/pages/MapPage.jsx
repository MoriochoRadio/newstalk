// 시장 지도 전용 화면 (11/13 피드백: "시장 지도는 차라리 더 키워서 따로 큰 화면으로")
// 오늘 기사가 많은 30종목: 칸 크기 = 오늘 기사 수, 색 = 어제 종가 대비 등락률 (빨강 오름·파랑 내림, 국내 관례)
// 색과 크기는 사실 두 개를 나란히 보여 줄 뿐 — 기사 때문에 움직였다는 뜻이 아님 (아래 안내)
import { useEffect, useMemo, useState } from 'react';
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
import MapPro from '../components/MapPro';
import { Link } from 'react-router-dom';
import { LayoutGrid } from 'lucide-react';

const LIMIT = 30;
const CAP_LIMIT = 24; // 시가총액 지도 칸 수

// 11/18: '기본 / 한눈에' — 한눈에 = FINVIZ 지도(업종별·빈틈없이·각진 칸, components/MapPro.jsx). 홈·종목과 같은 단추, 고른 것은 기억, 주소 ?view=cc
const VIEW_KEY = 'snm_map_view';
const VIEWS = [
  { key: 'basic', label: '기본' },
  { key: 'cc', label: '한눈에' },
];
function useMapView() {
  const [view, setView] = useState(() => {
    const q = new URLSearchParams(window.location.search).get('view');
    if (q === 'cc' || q === 'basic') return q;
    try {
      return localStorage.getItem(VIEW_KEY) === 'cc' ? 'cc' : 'basic';
    } catch {
      return 'basic';
    }
  });
  const set = (v) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* 기억 못 해도 지금 화면은 바뀜 */
    }
  };
  return [view, set];
}

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
  const [view, setView] = useMapView();
  // 지도 두 가지 (11/16 저녁): 시가총액 지도(FINVIZ 방식, 코스피·코스닥 시총 상위) / 오늘 기사 많은 종목 지도. 서버가 시총 지도를 모르면 기사 지도만
  const [mode, setMode] = useState('cap');
  const capMap = useApi((signal) => quoteApi.marketMap({ signal }), []);
  const capReady = Boolean(capMap.data?.items?.length);
  // 시총 지도를 받는 중이면 뼈대만 (11/16 밤 액터: 기사 지도가 먼저 떴다가 통째로 바뀜). 서버가 모르면(오류·빈 값) 기사 지도로
  const capPending = mode === 'cap' && capMap.loading && !capMap.data && !capMap.error;
  const showCap = mode === 'cap' && capReady;
  const showNews = !showCap && !capPending;
  // 지도에 그리는 24종목 (CapMap 과 같은 순서·개수) — 아래 '많이 오른·내린'도 이 종목으로 (11/16 밤 리뷰: 지도에 없는 종목이 1등)
  const capItems = useMemo(
    () => (capReady ? [...capMap.data.items].sort((a, b) => b.marketCap - a.marketCap).slice(0, CAP_LIMIT).map((it) => ({ ...it, sector: '', sectorName: it.sector })) : []),
    [capReady, capMap.data]
  );
  // 지도가 실제로 그린 칸 수 (넓은 화면 24, 휴대폰 16) — 목록·부제를 지도와 같은 종목으로
  const [drawn, setDrawn] = useState(() => (typeof window !== 'undefined' && window.innerWidth < 600 ? 16 : CAP_LIMIT)); // 휴대폰은 처음부터 16 (24 → 16 으로 바뀌어 보였음)
  const shownCap = useMemo(() => capItems.slice(0, drawn), [capItems, drawn]);
  const capQuotes = useMemo(() => Object.fromEntries(capItems.map((it) => [it.stockCode, { price: it.price, changeRate: it.changeRate, priceLimit: it.priceLimit }])), [capItems]);
  const capNews = useMemo(() => {
    const out = {};
    if (!feed.data || !capItems.length) return out;
    const news = feed.data.items.filter((a) => !a.isDisclosure);
    capItems.forEach((it) => {
      const n = news.filter((a) => a.relatedStocks.some((s) => s.code === it.stockCode)).length;
      if (n) out[it.stockCode] = { count: n, top: pickWhy(news, it.stockCode) };
    });
    return out;
  }, [feed.data, capItems]);
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

  if (view === 'cc') {
    return (
      <>
        <div className="page-head home-head is-cc">
          <div style={{ minWidth: 0 }}>
            <h1 className="page-title">
              시장 지도 <span className="title-date num">{todayLabel()}</span>
            </h1>
          </div>
          <div className="home-view">
            <Segmented label="지도 보기 방식" size="sm" options={VIEWS} value={view} onChange={setView} />
          </div>
        </div>
        {capMap.error && !capMap.data ? (
          <ErrorBox error={capMap.error} onRetry={capMap.reload} text="시가총액 지도를 받지 못했어요. '기본'의 기사 많은 종목 지도는 볼 수 있어요." />
        ) : !capReady ? (
          <div className="skeleton" style={{ height: height + 120 }} />
        ) : (
          <MapPro items={capMap.data.items} news={capNews} fetchedAt={capMap.data.fetchedAt} height={Math.max(480, height + 40)} />
        )}
      </>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">
            시장 지도 <span className="title-date num">{todayLabel()}</span>
          </h1>
          <p className="page-sub">
            {showCap || capPending // 시총 지도를 받는 동안에도 같은 부제 (뼈대 위에 '기사 많은 종목' 부제가 나왔음)
              ? `시가총액 상위 ${shownCap.length || CAP_LIMIT}종목 · 색 = 오늘 등락률 · 칸을 누르면 종목 화면`
              : '오늘 기사가 많은 종목 · 크기 = 그 종목 오늘 기사 전부(여러 소식의 합) · 색 = 오늘 등락률'}
          </p>
        </div>
        <div className="home-view" style={{ display: 'flex', gap: 8 }}>
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
          <Segmented label="지도 보기 방식" size="sm" options={VIEWS} value={view} onChange={setView} />
        </div>
      </div>
      <section className="card map-page" aria-label={showCap ? `시가총액 상위 ${shownCap.length || CAP_LIMIT}종목 지도` : `오늘 기사가 많은 ${items.length || LIMIT}종목 지도`}>
        {showNews && issues.error && <ErrorBox error={issues.error} onRetry={issues.reload} />}
        {(capPending || (showNews && issues.loading && !issues.data)) && <div className="skeleton" style={{ height, borderRadius: 'var(--radius)' }} />}
        {showCap && (
          <>
            {/* 업종 상자로 나누면 칸이 잘게 깨져 글자가 안 들어감 (11/16 사용자) → 한 덩어리, 업종은 마우스를 올린 설명에 */}
            <CapMap items={capItems} news={capNews} height={height} maxShare={0.12} limit={CAP_LIMIT} onDrawn={setDrawn} />
            <CapLegend size="시가총액 (큰 종목은 줄여 그림)" grouped={false} asOf={capMap.data.fetchedAt} />
          </>
        )}
        {showNews && items.length > 0 && <MarketMap tiles={tiles} priceReady={!disabled && !loading} height={height} />}
        {showNews && items.length > 0 && <MapLegend priceReady={!disabled} />}
        {/* 오늘 기사에 나온 종목이 없을 때(자정 직후·수집 멈춤): 빈 칸 대신 (11/16 QA) */}
        {showNews && issues.data && items.length === 0 && (
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
      {showCap ? (
        <div style={{ marginTop: 16 }}>
          <Movers issues={shownCap} quotes={capQuotes} top={5} title={`지도 ${shownCap.length}종목 중 많이 오른·내린`} />
        </div>
      ) : (
        showNews &&
        items.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Movers issues={items} quotes={quotes} disabled={disabled} loading={loading} top={5} title={`기사 많은 ${items.length}종목 중 많이 오른·내린`} />
          </div>
        )
      )}
    </>
  );
}
