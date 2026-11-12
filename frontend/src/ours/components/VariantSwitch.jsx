// 시안 비교용 전환 버튼 (11/12, 실험 브랜치 전용 — 고른 뒤 지움). 화면 오른쪽 아래, 고른 값은 이 브라우저에만 기억
// 2차: 색만이 아니라 모양(모서리·그림자/선)·사이드바까지 묶은 '완성 시안'. 파랑은 모두 유지 (사용자: "파랑이 제일 좋다")
import { useEffect, useState } from 'react';

const KEY = 'snm_ours_preset';
const PRESETS = [
  { key: 'toss', label: 'A 토스 원본', attrs: {} },
  { key: 'gray', label: 'E 파랑 + 회색', attrs: { variant: 'e' } },
  { key: 'sharp', label: 'F 단단한 금융', attrs: { variant: 'e', shape: 'sharp' } },
  { key: 'ink', label: 'G 남색 사이드바', attrs: { variant: 'e', shape: 'soft', nav: 'ink' } },
  { key: 'flat', label: 'H 지면형', attrs: { variant: 'e', shape: 'flat' } },
  // 스킬 시안 (G 위에 얹음): unslop 정리 모드 / frontend-design 위계 배치
  { key: 'unslop', label: 'I unslop', attrs: { variant: 'e', shape: 'soft', nav: 'ink', style: 'unslop' } },
  { key: 'fd', label: 'J frontend-design', attrs: { variant: 'e', shape: 'soft', nav: 'ink', style: 'fd' } },
];
const ATTRS = ['variant', 'shape', 'nav', 'style'];
// 11/12 저녁: 사용자가 G(남색 사이드바)를 고름 → 기본값
const DEFAULT = 'ink';
// 좋은·나쁜 소식 표시 방식 비교 (components/Tone.jsx)
const TONE_KEY = 'snm_ours_tone2'; // 11/12 밤 기본값이 링으로 바뀌어 새 이름 (예전 선택이 남아 링이 안 보이지 않게)
const TONES = [
  { key: 'ring', label: '링' },
  { key: 'label', label: '작은 점' },
  { key: 'tint', label: '링+물들임' },
  { key: 'off', label: '끔' },
];

function read(k, d) {
  try {
    return localStorage.getItem(k) || d;
  } catch {
    return d;
  }
}

export default function VariantSwitch() {
  const [key, setKey] = useState(() => read(KEY, DEFAULT));
  const [tone, setTone] = useState(() => read(TONE_KEY, 'ring'));
  useEffect(() => {
    document.documentElement.setAttribute('data-tone', tone);
    try {
      localStorage.setItem(TONE_KEY, tone);
    } catch {
      /* 저장 못 해도 화면은 바뀜 */
    }
  }, [tone]);
  useEffect(() => {
    const root = document.documentElement;
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
      <span className="vs-sep">소식 표시</span>
      {TONES.map((t) => (
        <button key={t.key} type="button" className={tone === t.key ? 'on' : ''} aria-pressed={tone === t.key} onClick={() => setTone(t.key)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}
