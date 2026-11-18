// '한눈에'(전문가) 모드 — 앱 전체 하나의 스위치 (11/18 사용자: "메인에서 토글 스위치처럼 누르면 모든 화면이 동글하지 않고 전문적으로")
// 켜면: 홈 = 컨트롤 센터, 시장 지도 = FINVIZ 지도, 뉴스·공시·종목 = 작게 보기, 관심 종목 = 표 + 소식 나란히,
//       모든 화면 = 각진 칸·작은 글자·얇은 선 (<html data-pro> → styles/pro.css)
// 끄면: 간편한 기본 화면 그대로. 고른 값은 이 브라우저에 기억. 주소 ?pro=1|0 (예전 링크 ?view=cc 도 켬)
import { useSyncExternalStore } from 'react';

const KEY = 'snm_pro';
const subs = new Set();

function initial() {
  if (typeof window === 'undefined') return false;
  const q = new URLSearchParams(window.location.search);
  const p = q.get('pro') ?? (q.get('view') === 'cc' ? '1' : null);
  if (p === '1' || p === '0') {
    try {
      localStorage.setItem(KEY, p);
    } catch {
      /* 기억 못 해도 이번 화면은 적용 */
    }
    return p === '1';
  }
  try {
    const saved = localStorage.getItem(KEY);
    if (saved != null) return saved === '1';
    return localStorage.getItem('snm_home_view') === 'cc'; // 예전 홈 '한눈에'를 고른 사람은 켠 채로
  } catch {
    return false;
  }
}

let pro = initial();

function apply() {
  if (typeof document !== 'undefined') document.documentElement.toggleAttribute('data-pro', pro);
}
apply();

export function setPro(value) {
  pro = Boolean(value);
  try {
    localStorage.setItem(KEY, pro ? '1' : '0');
  } catch {
    /* 기억 못 해도 지금 화면은 바뀜 */
  }
  apply();
  subs.forEach((fn) => fn());
}

const subscribe = (fn) => {
  subs.add(fn);
  return () => subs.delete(fn);
};

/** [켜졌나, 바꾸기] */
export function useProMode() {
  const value = useSyncExternalStore(subscribe, () => pro, () => false);
  return [value, setPro];
}
