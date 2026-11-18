// 언급량 추이 막대 (GET /api/stocks/{code}/mentions). 칸마다 뉴스·SNS 를 쌓아 그림
// x축 글자는 칸 수에 맞춰 띄엄띄엄 (휴대폰에서 "00:0101:02…"처럼 겹치던 V7 문제)
import { useEffect, useRef, useState } from 'react';

// 그림 폭 = 실제 칸 폭 (viewBox 를 줄이면 휴대폰에서 글자가 6px 로 작아짐)
const H = 170;
const PAD = { l: 28, r: 8, t: 10, b: 22 };

const labelOf = (time, unit) =>
  unit === 'HOUR' ? `${String(time).slice(11, 13)}시` : `${Number(String(time).slice(5, 7))}/${Number(String(time).slice(8, 10))}`;

export default function MentionChart({ data, periodLabel = '' }) {
  const [hover, setHover] = useState(null);
  const [W, setW] = useState(600);
  const boxRef = useRef(null);
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([entry]) => setW(Math.max(240, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const items = data?.items || [];
  const max = Math.max(1, ...items.map((p) => p.totalCount));
  if (items.length === 0) return <div ref={boxRef} />;
  const niceMax = max <= 2 ? 2 : max <= 8 ? Math.ceil(max / 2) * 2 : Math.ceil(max / 4) * 4;
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  const step = plotW / items.length;
  const barW = Math.max(2, Math.min(22, step * 0.62));
  const labelEvery = Math.max(1, Math.ceil(items.length / Math.max(3, Math.floor(plotW / 56))));
  const y = (v) => PAD.t + plotH - (v / niceMax) * plotH;
  const total = items.reduce((s, p) => s + p.totalCount, 0);
  const shown = hover != null ? items[hover] : null;

  return (
    <div ref={boxRef}>
      <p className="mention-tip" aria-live="polite">
        {shown
          ? `${labelOf(shown.time, data.unit)} · 기사 ${shown.newsCount}건${shown.snsCount ? ` · SNS ${shown.snsCount}건` : ''}`
          : `${periodLabel ? `${periodLabel} ` : '합계 '}${total.toLocaleString('ko-KR')}건`}
      </p>
      <svg className="mention-chart" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`언급량 추이, 합계 ${total}건, 가장 많은 칸 ${max}건`}>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line className="grid" x1={PAD.l} x2={W - PAD.r} y1={y(niceMax * f)} y2={y(niceMax * f)} />
            <text className="axis" x={PAD.l - 6} y={y(niceMax * f) + 4} textAnchor="end">
              {Math.round(niceMax * f)}
            </text>
          </g>
        ))}
        {items.map((p, i) => {
          const x = PAD.l + i * step + (step - barW) / 2;
          return (
            <g key={p.time} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={PAD.l + i * step} y={PAD.t} width={step} height={plotH} fill="transparent" />
              {/* dataviz: 쌓은 칸 사이 2px 틈 */}
              {p.snsCount > 0 && <rect className="bar-sns" x={x} y={y(p.totalCount)} width={barW} height={Math.max(1, y(p.newsCount) - y(p.totalCount) - 2)} rx="2" />}
              {p.newsCount > 0 && (
                <rect className="bar-news" x={x} y={y(p.newsCount)} width={barW} height={PAD.t + plotH - y(p.newsCount)} rx="2" opacity={hover == null || hover === i ? 1 : 0.45} />
              )}
              {i % labelEvery === 0 && (
                <text className="axis" x={PAD.l + i * step + step / 2} y={H - 6} textAnchor="middle">
                  {labelOf(p.time, data.unit)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
