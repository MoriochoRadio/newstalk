// 시안 비교용 전환 버튼 (11/12, 실험 브랜치 전용 — 고른 뒤 지움). 화면 오른쪽 아래, 고른 값은 이 브라우저에만 기억
import { useEffect, useState } from 'react';

const KEY = 'snm_ours_variant';
const OPTIONS = [
  { key: 'a', label: 'A 지금(토스 파랑)' },
  { key: 'b', label: 'B 잉크 네이비' },
  { key: 'c', label: 'C 청록' },
  { key: 'd', label: 'D 뉴스 주황' },
];

function read() {
  try {
    return localStorage.getItem(KEY) || 'a';
  } catch {
    return 'a';
  }
}

export default function VariantSwitch() {
  const [v, setV] = useState(read);
  useEffect(() => {
    const root = document.documentElement;
    if (v === 'a') root.removeAttribute('data-variant');
    else root.setAttribute('data-variant', v);
    try {
      localStorage.setItem(KEY, v);
    } catch {
      /* 저장 못 해도 화면은 바뀜 */
    }
  }, [v]);
  return (
    <div className="variant-switch" role="group" aria-label="디자인 시안 비교">
      <span>시안</span>
      {OPTIONS.map((o) => (
        <button key={o.key} type="button" className={v === o.key ? 'on' : ''} aria-pressed={v === o.key} onClick={() => setV(o.key)} title={o.label}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
