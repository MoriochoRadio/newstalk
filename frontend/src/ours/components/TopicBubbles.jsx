// '오늘 많이 나온 주제' 거품 그림 (11/16 저녁 사용자: "많이 나온 주제 그래프를 워드클라우드 느낌으로, 세련되게")
// - 거품 하나 = 주제 하나(실적·신제품·증권사 의견 …), 크기 = 그 주제를 다룬 오늘 기사 수
// - 11/16 사용자 2차: "주제가 뭔지, 실적이 뭐? 어쩌라는 거지?" → 거품을 누르면 옆에 '무슨 낱말로 나눴는지 + 대표 기사 3개'
// - 가운데부터 나선으로 겹치지 않게, 하나씩 부풀어 오른 뒤 천천히 둥실 (움직임 줄이기면 멈춤)
// - 누르면 오늘 그 주제 낱말로 기사 검색
// 색: 보라 한 가지 농도 (빨강·파랑 = 등락, 초록·주황 = 좋은·나쁜 소식이라 피함)
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { relativeTime } from '../lib/format';
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
  const total = rows.reduce((s, r) => s + r.size, 0) || 1;
  // 전체 거품 넓이가 상자의 약 42% 가 되게 (여백을 넉넉히)
  const k = Math.sqrt((width * height * 0.42) / (Math.PI * total));
  const placed = [];
  const cx = width / 2;
  const cy = height / 2;
  for (const r of rows) {
    const rad = Math.max(30, Math.min(height / 2 - 6, k * Math.sqrt(r.size)));
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
  const sized = useMemo(() => rows.map((r) => ({ ...r, size: r.articles || r.count })).sort((a, b) => b.size - a.size), [rows]);
  const max = Math.max(1, ...sized.map((r) => r.size));
  const bubbles = useMemo(() => (width ? pack(sized, width, height) : []), [sized, width, height]);
  const [sel, setSel] = useState(null);
  const cur = sized.find((r) => r.label === sel) || sized[0];
  const words = TOPICS.find((t) => t.label === cur?.label)?.words || [];
  const tops = cur ? [...cur.stories].sort((x, y) => (y.size || 1) - (x.size || 1)).slice(0, 3) : [];
  return (
    <div className="topic-wrap">
      <div className="topic-bubbles" ref={boxRef} style={{ height }}>
        <ul aria-label="오늘 기사가 많이 다룬 주제">
          {bubbles.map((b, i) => {
            const level = b.size / max; // 0~1: 클수록 진하게
            const on = cur?.label === b.label;
            return (
              <li
                key={b.label}
                className={`tb-bubble ${on ? 'on' : ''}`}
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
                <button type="button" aria-pressed={on} onClick={() => setSel(b.label)} title={`'${b.label}' 기사 ${b.size}건 보기`}>
                  <span className="tb-label" style={{ fontSize: Math.max(13, Math.min(26, b.r / 2.6)) }}>
                    {b.label}
                  </span>
                  <span className="tb-count num" style={{ fontSize: Math.max(12, Math.min(18, b.r / 3.6)) }}>
                    {b.size}건
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      {cur && (
        <aside className="topic-detail" aria-live="polite">
          <p className="td-head">
            <b>{cur.label}</b> 이야기를 다룬 기사 <b className="num">{cur.size}</b>건
          </p>
          <p className="td-how">오늘 기사 제목·요약에 '{words.slice(0, 4).join('·')}' 같은 말이 나온 기사예요</p>
          <ul className="td-list">
            {tops.map((st) => {
              const main = st.lead.relatedStocks?.find((x) => x.role === 'MAIN') || st.lead.relatedStocks?.[0];
              return (
                <li key={st.lead.id}>
                  <Link to={`/news/${st.lead.id}`}>{st.lead.title}</Link>
                  <span className="muted num">
                    {main ? `${main.name} · ` : ''}
                    {(st.size || 1) > 1 ? `같은 내용 기사 ${st.size}건 · ` : ''}
                    {relativeTime(st.lead.publishedAtIso)}
                  </span>
                </li>
              );
            })}
          </ul>
          <Link className="link td-more" to={`/search?q=${encodeURIComponent(words[0] || cur.label)}&period=today`}>
            '{cur.label}' 기사 모두 보기
          </Link>
        </aside>
      )}
    </div>
  );
}
