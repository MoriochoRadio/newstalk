// '오늘 많이 나온 주제' 거품 그림 (11/16 저녁 사용자: "많이 나온 주제 그래프를 워드클라우드 느낌으로, 세련되게")
// - 거품 하나 = 주제 하나(실적·신제품·증권사 의견 …), 크기 = 그 주제의 오늘 소식 수 (같은 내용 기사는 하나로)
// - 가운데부터 나선으로 겹치지 않게, 하나씩 부풀어 오른 뒤 천천히 둥실 (움직임 줄이기면 멈춤)
// - 누르면 오늘 그 주제 낱말로 기사 검색
// 색: 보라 한 가지 농도 (빨강·파랑 = 등락, 초록·주황 = 좋은·나쁜 소식이라 피함)
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { TOPICS } from '../lib/digest';

function useWidth(ref) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    setW(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

function pack(rows, width, height) {
  const total = rows.reduce((s, r) => s + r.count, 0) || 1;
  // 전체 거품 넓이가 상자의 약 42% 가 되게 (여백을 넉넉히)
  const k = Math.sqrt((width * height * 0.42) / (Math.PI * total));
  const placed = [];
  const cx = width / 2;
  const cy = height / 2;
  for (const r of rows) {
    const rad = Math.max(30, Math.min(height / 2 - 6, k * Math.sqrt(r.count)));
    let spot = null;
    for (let t = 0; t < 2000; t += 1) {
      const a = t * 0.3;
      const d = 2.2 * a;
      const x = cx + d * Math.cos(a) * 1.5;
      const y = cy + d * Math.sin(a);
      if (x - rad < 2 || x + rad > width - 2 || y - rad < 2 || y + rad > height - 2) continue;
      if (placed.every((p) => Math.hypot(p.x - x, p.y - y) >= p.r + rad + 8)) {
        spot = { x, y };
        break;
      }
    }
    if (spot) placed.push({ ...r, ...spot, r: rad });
  }
  return placed;
}

export default function TopicBubbles({ rows, height = 300 }) {
  const boxRef = useRef(null);
  const width = useWidth(boxRef);
  const max = Math.max(1, ...rows.map((r) => r.count));
  const bubbles = useMemo(() => (width ? pack(rows, width, height) : []), [rows, width, height]);
  return (
    <div className="topic-bubbles" ref={boxRef} style={{ height }}>
      <ul aria-label="오늘 많이 나온 주제">
        {bubbles.map((b, i) => {
          const word = TOPICS.find((t) => t.label === b.label)?.words[0] || b.label;
          const level = b.count / max; // 0~1: 클수록 진하게
          return (
            <li
              key={b.label}
              className="tb-bubble"
              style={{
                left: b.x - b.r,
                top: b.y - b.r,
                width: b.r * 2,
                height: b.r * 2,
                '--tb-level': `${Math.round(8 + level * 22)}%`,
                '--tb-delay': `${i * 90}ms`,
                '--tb-float': `${6 + (i % 4)}s`,
              }}
            >
              <Link to={`/search?q=${encodeURIComponent(word)}&period=today`} title={`오늘 '${b.label}' 이야기 ${b.count}개 (같은 내용 기사는 하나로) — 눌러서 기사 보기`}>
                <span className="tb-label" style={{ fontSize: Math.max(13, Math.min(26, b.r / 2.6)) }}>
                  {b.label}
                </span>
                <span className="tb-count num" style={{ fontSize: Math.max(12, Math.min(20, b.r / 3.4)) }}>
                  {b.count}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
