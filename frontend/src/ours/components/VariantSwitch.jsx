// 시안 비교용 전환 버튼 (실험 브랜치 전용 — 하나로 정하면 지움). 화면 오른쪽 아래, 고른 값은 이 브라우저에만 기억
// 11/12 밤 사용자 선택: 후보는 G(남색 사이드바)·J(frontend-design) 둘만, 소식 표시는 링으로 고정
//   (나머지 A·E·F·H·I 와 작은 점·물들임·끔 비교는 끝남 — 기록 frontend-ours/README.md 17·18절, 비교 모음 gallery-1112)
import { useEffect, useState } from 'react';

const KEY = 'snm_ours_preset2'; // 후보가 줄어 새 이름 (예전에 고른 I·A 등이 남아 엉뚱한 시안이 뜨지 않게)
const PRESETS = [
  { key: 'ink', label: 'G 남색 사이드바', attrs: { variant: 'e', shape: 'soft', nav: 'ink' } },
  { key: 'fd', label: 'J 머리기사 크게', attrs: { variant: 'e', shape: 'soft', nav: 'ink', style: 'fd' } },
];
const ATTRS = ['variant', 'shape', 'nav', 'style'];

function read(k, d) {
  try {
    return localStorage.getItem(k) || d;
  } catch {
    return d;
  }
}

export default function VariantSwitch() {
  const [key, setKey] = useState(() => read(KEY, 'ink'));
  useEffect(() => {
    const root = document.documentElement;
    root.removeAttribute('data-tone'); // 링 고정 (data-tone 이 없으면 링)
    const preset = PRESETS.find((p) => p.key === key) || PRESETS[0];
    ATTRS.forEach((a) => {
      if (preset.attrs[a]) root.setAttribute(`data-${a}`, preset.attrs[a]);
      else root.removeAttribute(`data-${a}`);
    });
    try {
      localStorage.setItem(KEY, key);
    } catch {
      /* 저장 못 해도 화면은 바뀜 */
    }
  }, [key]);
  return (
    <div className="variant-switch" role="group" aria-label="디자인 시안 비교">
      <span>시안</span>
      {PRESETS.map((p) => (
        <button key={p.key} type="button" className={key === p.key ? 'on' : ''} aria-pressed={key === p.key} onClick={() => setKey(p.key)}>
          {p.label}
        </button>
      ))}
    </div>
  );
}
