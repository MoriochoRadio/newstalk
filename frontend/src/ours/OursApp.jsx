// 우리 안 화면 묶음 (README 5절 정보 구조)
import { Route, Routes } from 'react-router-dom';
import './styles/tokens.css';
import './styles/app.css';

// 디자인 확정 (11/12 밤 사용자: "남색 사이드바 형으로 진행"): G = 중립 회색(e) + 둥근 카드(soft) + 남색 왼쪽 메뉴(ink)
// 시안 비교 버튼(VariantSwitch)과 J·I 시안 코드는 지움 — 비교 기록은 _local/frontend-ours/README.md 15~18절, gallery-1112
const root = document.documentElement;
root.setAttribute('data-variant', 'e');
root.setAttribute('data-shape', 'soft');
root.setAttribute('data-nav', 'ink');
import { SessionProvider } from './app/session';
import Shell from './app/Shell';
import HomePage from './pages/HomePage';
import NewsPage from './pages/NewsPage';
import NewsDetailPage from './pages/NewsDetailPage';
import StocksPage from './pages/StocksPage';
import MapPage from './pages/MapPage';
import StockDetailPage from './pages/StockDetailPage';
import WatchlistPage from './pages/WatchlistPage';
import SearchPage from './pages/SearchPage';
import NotFoundPage from './pages/NotFoundPage';

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
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </SessionProvider>
  );
}
