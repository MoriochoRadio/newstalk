// ============================================================================
// 화면 주소 (react-router). 우리 안(태경 안, src/ours)이 기본이고, 서준님 V7 은 /v7 에서 그대로 비교
// - 두 화면은 CSS 가 섞이지 않게 각각 따로 불러옴 (lazy: 그 주소에 들어갈 때만 파일을 받음)
// - V2~V6 옛 화면은 import 하지 않음 (파일은 그대로 둠)
// ============================================================================
import { Suspense, lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

const OursApp = lazy(() => import('./ours/OursApp'));
const DashboardPageV7 = lazy(() => import('./pages/DashboardPageV7'));

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/v7" element={<DashboardPageV7 />} />
          <Route path="/*" element={<OursApp />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
