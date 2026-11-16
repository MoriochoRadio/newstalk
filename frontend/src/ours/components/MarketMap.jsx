// 오늘 시장 지도: 이슈 종목을 한 장에 — 칸 크기 = 오늘 기사 수, 색 = 오늘 등락률(빨강 오름 · 파랑 내림, 진할수록 크게)
// 큰 칸에는 "왜" 한 줄(그 종목이 주인공인 오늘 최신 기사 제목)을 바로 쓰고, 작은 칸은 마우스를 올리거나 키보드로 가면 보여 줌
// 배치: squarified treemap (Bruls·Huizing·van Wijk 2000) — 칸이 되도록 정사각형에 가깝게 나뉘는 방식. 라이브러리 없이 직접 계산
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { fmtRate } from '../lib/format';

/** 등락률 → 색 단계 (토큰 --heat-*) */
export function heatLevel(rate) {
  if (rate == null || Number.isNaN(Number(rate))) return 'none';
  const r = Number(rate);
  const a = Math.abs(r);
  if (a < 0.005) return 'flat';
  const step = a >= 3 ? 3 : a >= 1 ? 2 : 1;
  return `${r > 0 ? 'up' : 'down'}-${step}`;
}

/** 칸 나누기. values 는 큰 것부터. 돌려주는 값: [{ i, x, y, w, h }] (px) */
export function squarify(values, width, height) {
  const total = values.reduce((s, v) => s + v, 0);
  if (!total || width <= 0 || height <= 0) return [];
  const scale = (width * height) / total;
  const areas = values.map((v, i) => ({ i, a: v * scale }));
  const out = [];
  let x = 0;
  let y = 0;
  let w = width;
  let h = height;
  const worst = (row, len) => {
    const s = row.reduce((t, r) => t + r.a, 0);
    const mx = Math.max(...row.map((r) => r.a));
    const mn = Math.min(...row.map((r) => r.a));
    return Math.max((len * len * mx) / (s * s), (s * s) / (len * len * mn));
  };
  const place = (row) => {
    const s = row.reduce((t, r) => t + r.a, 0);
    if (w >= h) {
      const cw = s / h;
      let cy = y;
      row.forEach((r) => {
        const rh = r.a / cw;
        out.push({ i: r.i, x, y: cy, w: cw, h: rh });
        cy += rh;
      });
      x += cw;
      w -= cw;
    } else {
      const rh = s / w;
      let cx = x;
      row.forEach((r) => {
        const rw = r.a / rh;
        out.push({ i: r.i, x: cx, y, w: rw, h: rh });
        cx += rw;
      });
      y += rh;
      h -= rh;
    }
  };
  let row = [];
  let k = 0;
  while (k < areas.length) {
    const len = Math.min(w, h);
    const next = [...row, areas[k]];
    if (row.length === 0 || worst(next, len) <= worst(row, len)) {
      row = next;
      k += 1;
    } else {
      place(row);
      row = [];
    }
  }
  if (row.length) place(row);
  return out;
}

const GAP = 3;

/**
 * tiles: [{ code, name, articleCount, eventCount, disclosureCount, rate, why }]
 * rate 가 null 이면 회색 (시세가 없거나 아직 받는 중)
 */
export default function MarketMap({ tiles, height = 320, priceReady = true }) {
  const boxRef = useRef(null);
  const [width, setWidth] = useState(0);
  const [tip, setTip] = useState(null); // { idx }

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    setWidth(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 휴대폰처럼 좁으면 위 16종목만 (11/16: 30칸이면 'G…'·'H…' 처럼 이름이 다 잘림. 나머지는 아래 등락 목록·종목 화면에서)
  const shown = width && width < 520 ? tiles.slice(0, 16) : tiles;
  const rects = width ? squarify(shown.map((t) => Math.max(1, t.articleCount)), width, height) : [];
  const tipTile = tip != null ? shown[tip] : null;
  const tipRect = tip != null ? rects.find((r) => r.i === tip) : null;

  return (
    <div className="map" ref={boxRef} style={{ height }} onMouseLeave={() => setTip(null)}>
      <ul className="map-tiles" aria-label="오늘의 이슈 종목 지도">
        {rects.map((r) => {
          const t = shown[r.i];
          const level = priceReady ? heatLevel(t.rate) : 'none';
          const w = r.w - GAP;
          const h = r.h - GAP;
          const big = w >= 160 && h >= 110;
          const showRate = w >= 64 && h >= 52;
          const showName = w >= 44 && h >= 30;
          // 이름이 칸 너비를 넘지 않게 (한글 한 자 ≈ 1em, 좌우 여백 약 20px). 최소 11px
          const nameSize = Math.round(Math.max(11, Math.min(22, Math.sqrt(w * h) / 9, (w - 20) / (Math.max(2, t.name.length) * 0.95))));
          const label = `${t.name}, 오늘 기사 ${t.articleCount}건${t.rate != null ? `, 등락률 ${fmtRate(t.rate)}` : ''}${t.why ? `. ${t.why.title}` : ''}`;
          return (
            <li key={t.code} style={{ left: r.x, top: r.y, width: w, height: h, animationDelay: `${Math.min(r.i, 12) * 30}ms` }} className="map-cell">
              <Link
                to={`/stocks/${t.code}`}
                className={`map-tile heat-${level}`}
                aria-label={label}
                onMouseEnter={() => setTip(r.i)}
                onFocus={() => setTip(r.i)}
                onBlur={() => setTip(null)}
              >
                {showName && (
                  <span className="map-name" style={{ fontSize: nameSize }}>
                    {t.name}
                  </span>
                )}
                {showRate && (
                  <span className="map-rate num" style={{ fontSize: Math.max(12, nameSize - 4) }}>
                    {t.rate != null ? fmtRate(t.rate) : ''}
                    {w >= 120 && <span className="map-count"> 기사 {t.articleCount}</span>}
                  </span>
                )}
                {big && t.why && <span className="map-why">{t.why.title}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
      {tipTile && tipRect && (
        <div
          className="map-tip"
          role="tooltip"
          style={{
            left: Math.min(Math.max(8, tipRect.x + tipRect.w / 2 - 150), width - 308),
            top: tipRect.y + tipRect.h + 8 > height - 40 ? Math.max(4, tipRect.y - 8) : tipRect.y + tipRect.h + 4,
            transform: tipRect.y + tipRect.h + 8 > height - 40 ? 'translateY(-100%)' : undefined,
          }}
        >
          <p className="map-tip-head">
            <b>{tipTile.name}</b>
            {tipTile.rate != null && <span className={`change ${tipTile.rate > 0 ? 'up' : tipTile.rate < 0 ? 'down' : 'flat'}`}>{fmtRate(tipTile.rate)}</span>}
          </p>
          <p className="map-tip-meta num">
            오늘 기사 {tipTile.articleCount}건
            {tipTile.eventCount && tipTile.eventCount !== tipTile.articleCount ? ` · 소식 ${tipTile.eventCount}건` : ''}
            {tipTile.disclosureCount > 0 ? ` · 공시 ${tipTile.disclosureCount}건` : ''}
          </p>
          {tipTile.why && <p className="map-tip-why">{tipTile.why.title}</p>}
        </div>
      )}
    </div>
  );
}

/** 지도 아래 색 기준 */
export function MapLegend({ priceReady }) {
  if (!priceReady) return <p className="map-legend muted">시세가 없어 색 없이 기사 수만 보여 드려요.</p>;
  const steps = [
    ['down-3', '-3%'],
    ['down-2', '-1%'],
    ['down-1', ''],
    ['flat', '0'],
    ['up-1', ''],
    ['up-2', '+1%'],
    ['up-3', '+3%'],
  ];
  return (
    <div className="map-legend">
      <span className="sr-only">색 기준: 빨강은 오름, 파랑은 내림, 진할수록 많이 움직임.</span>
      <span>칸 크기 = 오늘 기사 수</span>
      <span className="map-scale" aria-hidden="true">
        {steps.map(([k, t]) => (
          <span key={k} className={`heat-${k}`}>
            {t}
          </span>
        ))}
      </span>
    </div>
  );
}
