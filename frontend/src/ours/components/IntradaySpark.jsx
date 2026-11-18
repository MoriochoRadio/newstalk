// 화제 종목 카드의 '오늘' 미니 차트 (11/18 사용자: 넓고 낮은 칸에 20일 흐름선·미니 캔들은 주식 하는 사람에게 별로)
// 증권 앱의 당일 차트 방식: 가로축은 장 시간 전체(첫 봉부터 6시간 30분)로 고정해 지금까지 움직인 만큼만 그리고,
// 어제 종가에 점선 → 그 위는 빨강, 아래는 파랑. 칸 폭을 재서 그림(늘려 그리지 않음). 2분마다 새로 받음
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { wantIntraday } from '../lib/intraday';

const H = 40;
const SESSION_MS = 390 * 60_000; // 평소 09:00~15:30, 수능일 10:00~16:30 → 첫 봉 시각부터 6시간 30분

export default function IntradaySpark({ code, name, quote, disabled = false }) {
  const box = useRef(null);
  const [w, setW] = useState(0);
  const [entry, setEntry] = useState(null);
  const [tick, setTick] = useState(0);
  const clipId = useId().replace(/:/g, '');

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const measure = () => setW(Math.round(el.getBoundingClientRect().width));
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [entry?.data]);

  useEffect(() => {
    if (disabled) return undefined;
    const t = setInterval(() => setTick((n) => n + 1), 120_000);
    return () => clearInterval(t);
  }, [disabled]);
  useEffect(() => {
    if (disabled) return undefined;
    return wantIntraday(code, (e) => setEntry({ status: e.status, data: e.data }));
  }, [code, disabled, tick]);

  const rows = entry?.data?.rows;
  if (disabled || !rows) {
    return (
      <>
        <span className="ispark ispark-empty" ref={box} aria-hidden="true" />
        <span className="ispark-label" />
      </>
    );
  }

  // 기준선: 어제 종가 (지금 값 - 전일 대비). 시세가 없으면 첫 봉 시가
  const date = entry.data.date || '';
  const today = date === new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
  const prev = today && quote && quote.changeAmount != null ? quote.price - quote.changeAmount : rows[0].o;
  const pts = rows.map((r) => ({ t: r.t, v: r.c }));
  if (today && quote) pts[pts.length - 1] = { ...pts[pts.length - 1], v: quote.price }; // 마지막 점은 지금 값
  const vals = pts.map((p) => p.v).concat(prev);
  const hi = Math.max(...vals);
  const lo = Math.min(...vals);
  const span = hi - lo || 1;
  const t0 = rows[0].t;
  const x = (t) => 1 + Math.min(1, (t - t0) / SESSION_MS) * Math.max(0, w - 4);
  const y = (v) => 3 + ((hi - v) / span) * (H - 6);
  const by = Math.round(y(prev)) + 0.5;
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const lastX = x(pts[pts.length - 1].t);
  const area = `${line} L${lastX.toFixed(1)},${by} L${x(t0).toFixed(1)},${by} Z`;
  const last = pts[pts.length - 1].v;
  const rate = prev ? ((last - prev) / prev) * 100 : 0;
  const md = date ? `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}` : '';
  const when = today ? '오늘' : md;
  const label = `${name} ${when} 5분 흐름, 기준선은 ${today ? '어제 종가' : '그날 시가'}, ${rate > 0 ? '+' : ''}${rate.toFixed(2)}%`;

  return (
    <>
      <span className="ispark" ref={box} title={label}>
        {w > 0 && (
          <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`} role="img" aria-label={label}>
            <defs>
              <clipPath id={`${clipId}u`}>
                <rect x="0" y="-4" width={w} height={by + 4} />
              </clipPath>
              <clipPath id={`${clipId}d`}>
                <rect x="0" y={by} width={w} height={H - by + 4} />
              </clipPath>
            </defs>
            <line x1="0" x2={w} y1={by} y2={by} className="ispark-base" />
            <g clipPath={`url(#${clipId}u)`} className="ispark-up">
              <path d={area} className="ispark-area" />
              <path d={line} className="ispark-line" />
            </g>
            <g clipPath={`url(#${clipId}d)`} className="ispark-down">
              <path d={area} className="ispark-area" />
              <path d={line} className="ispark-line" />
            </g>
            <circle cx={lastX} cy={y(last)} r="2.5" className={`ispark-dot ${last >= prev ? 'ispark-up' : 'ispark-down'}`} />
          </svg>
        )}
      </span>
      <span className="ispark-label">{when}</span>
    </>
  );
}
