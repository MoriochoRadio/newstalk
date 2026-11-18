// 우리 안 화면 묶음 (README 5절 정보 구조)
import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import './styles/tokens.css';
import './styles/app.css';
import './styles/polish-1118.css';
import './styles/compact-exp.css';
import './styles/pro.css';

// 디자인 확정 (11/12 밤 사용자: "남색 사이드바 형으로 진행"): G = 중립 회색(e) + 둥근 카드(soft) + 남색 왼쪽 메뉴(ink)
// 시안 비교 버튼(VariantSwitch)과 J·I 시안 코드는 지움 — 비교 기록은 _local/frontend-ours/README.md 15~18절, gallery-1112
const root = document.documentElement;
root.setAttribute('data-variant', 'e');
root.setAttribute('data-shape', 'soft');
root.setAttribute('data-nav', 'ink');
import { SessionProvider } from './app/session';
import Shell from './app/Shell';
import HomePage from './pages/HomePage';

// 첫 화면(홈)만 바로 싣고, 나머지 화면은 들어갈 때 받음 (11/13 최적화: 차트 라이브러리가 홈 묶음에 들어 있었음)
// 첫 화면이 뜬 뒤 쉬는 틈에 미리 받아 둬서 옮겨 갈 때 기다림이 없게 함
const pages = {
  news: () => import('./pages/NewsPage'),
  newsDetail: () => import('./pages/NewsDetailPage'),
  stocks: () => import('./pages/StocksPage'),
  map: () => import('./pages/MapPage'),
  stockDetail: () => import('./pages/StockDetailPage'),
  watchlist: () => import('./pages/WatchlistPage'),
  search: () => import('./pages/SearchPage'),
  account: () => import('./pages/AccountPage'),
  notice: () => import('./pages/NoticePage'),
  notFound: () => import('./pages/NotFoundPage'),
};
const NewsPage = lazy(pages.news);
const NewsDetailPage = lazy(pages.newsDetail);
const StocksPage = lazy(pages.stocks);
const MapPage = lazy(pages.map);
const StockDetailPage = lazy(pages.stockDetail);
const WatchlistPage = lazy(pages.watchlist);
const SearchPage = lazy(pages.search);
const AccountPage = lazy(pages.account);
const NoticePage = lazy(pages.notice);
const NotFoundPage = lazy(pages.notFound);

if (typeof window !== 'undefined') {
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1500));
  // 첫 화면 데이터가 다 온 뒤에 받도록 4초 미룸 (11/16 측정: 느린 휴대폰에서 첫 화면 API 와 대역폭을 다퉜음). 데이터 절약 모드면 안 받음
  const saveData = navigator.connection?.saveData;
  const prefetch = () => {
    if (saveData) return;
    setTimeout(() => idle(() => Object.values(pages).forEach((load) => load().catch(() => {}))), 4000);
  };
  // 이 파일 자체가 나중에 받아지므로 load 가 이미 지났을 수 있음
  if (document.readyState === 'complete') prefetch();
  else window.addEventListener('load', prefetch, { once: true });
}

export default function OursApp() {
  return (
    <SessionProvider>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<HomePage />} />
          <Route path="news" element={<NewsPage />} />
          <Route path="news/:id" element={<NewsDetailPage />} />
          <Route path="map" element={<MapPage />} />
          <Route path="stocks" element={<StocksPage />} />
          <Route path="stocks/:code" element={<StockDetailPage />} />
          <Route path="watchlist" element={<WatchlistPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="account" element={<AccountPage />} />
          <Route path="notice" element={<NoticePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </SessionProvider>
  );
}
