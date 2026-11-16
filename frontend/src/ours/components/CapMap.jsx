// 종목 지도(시가총액 지도) — FINVIZ 지도 방식 (11/16 저녁 사용자: "시총순으로, 종목별로 고도화해서 딱 그 지도처럼, 거기에 뉴스가 몇 건인지")
// - 묶음 = 거래소 업종(전기·전자, 금융 …), 칸 크기 = 시가총액, 색 = 오늘 등락률 (빨강 오름·파랑 내림, 국내 관례, 진할수록 크게)
// - 칸 안: 종목 이름 · 등락률 · '기사 n' (오늘 우리 서비스가 연결한 기사 수). 작은 칸은 기사 표시만 점으로
// - 마우스를 올리거나 초점을 주면: 업종·시가총액·등락·오늘 기사 수·대표 기사 제목. 누르면 종목 화면
// - 색과 크기·기사 수는 사실을 나란히 보여 줄 뿐, 기사 때문에 움직였다는 뜻이 아님
// 재료: GET /api/quotes/market-map (코스피·코스닥 시총 상위 각 30개, 우선주 제외)
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { squarify } from './MarketMap';
import { fmtRate } from '../lib/format';

const HEAD = 20; // 업종 이름 줄 높이
const GAP = 6; // 칸 사이 여백 (꽉 찬 느낌 줄이기)

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

/** 등락률 → 색 단계 (FINVIZ 처럼 7단계, 국내 관례 색) */
export function capHeat(rate) {
  if (rate == null) return 'cm-na';
  if (rate >= 3) return 'cm-u3';
  if (rate >= 1) return 'cm-u2';
  if (rate > 0.2) return 'cm-u1';
  if (rate > -0.2) return 'cm-0';
  if (rate > -1) return 'cm-d1';
  if (rate > -3) return 'cm-d2';
  return 'cm-d3';
}

/** 억 원 → '1,152조' / '9,531억' */
export function capText(eok) {
  if (!eok) return '–';
  if (eok >= 10000) return `${Math.round(eok / 10000).toLocaleString('ko-KR')}조`;
  return `${Math.round(eok).toLocaleString('ko-KR')}억`;
}

/**
 * items: [{ stockCode, stockName, sector, marketCap, changeRate, priceLimit }]
 * news: { [code]: { count, top: { id, title } } } — 오늘 기사 수와 대표 제목
 */
export default function CapMap({ items, news = {}, height = 520, limit = 20 }) {
  const boxRef = useRef(null);
  const width = useWidth(boxRef);
  const [tip, setTip] = useState(null);

  const layout = useMemo(() => {
    if (!width || !items.length) return [];
    // 휴대폰처럼 좁으면 시가총액 상위 30개만 (60개면 칸이 너무 잘아 이름이 다 잘림)
    // 주요 종목만 (11/16 사용자: 60개가 꽉 차서 답답·눈 아픔) → 크기 순 상위 limit 개, 휴대폰은 12개
    const list0 = [...items].sort((a, b) => b.marketCap - a.marketCap).slice(0, width < 520 ? Math.min(limit, 12) : limit);
    const bySector = new Map();
    list0.forEach((it) => {
      const k = it.sector ?? '기타';
      if (!bySector.has(k)) bySector.set(k, []);
      bySector.get(k).push(it);
    });
    const sectors = [...bySector.entries()]
      .map(([name, list]) => ({ name, list: list.sort((a, b) => b.marketCap - a.marketCap), total: list.reduce((s, x) => s + (x.marketCap || 0), 0) }))
      .filter((s) => s.total > 0)
      .sort((a, b) => b.total - a.total);
    // 시가총액 차이가 매우 커서(삼성전자 1,150조 vs 코스닥 3조) 그대로면 작은 종목이 안 보임 → 제곱근에 가깝게 눌러 줌 (0.6제곱)
    const weight = (v) => Math.max(1, v) ** 0.6;
    // 칸마다 오른쪽·아래 여백(GAP)을 빼므로 전체를 GAP 만큼 크게 나눠야 끝이 상자 끝과 맞음
    const secRects = squarify(sectors.map((s) => s.list.reduce((t, x) => t + weight(x.marketCap), 0)), width + GAP, height + GAP);
    return secRects.map((r) => {
      const s = sectors[r.i];
      const showHead = Boolean(s.name) && r.h >= HEAD + 30 && r.w >= 60;
      const top = showHead ? HEAD : 0;
      const inner = squarify(s.list.map((x) => weight(x.marketCap)), Math.max(0, r.w), Math.max(0, r.h - top));
      return { ...r, name: s.name, showHead, tiles: inner.map((t) => ({ ...t, it: s.list[t.i] })) };
    });
  }, [items, width, height, limit]);

  return (
    <div className="cap-map" ref={boxRef} style={{ height }} onMouseLeave={() => setTip(null)}>
      {layout.map((sec) => (
        <section key={sec.name} className="cm-sector" style={{ left: sec.x, top: sec.y, width: sec.w, height: sec.h }} aria-label={`${sec.name} 업종`}>
          {sec.showHead && <h3 className="cm-head">{sec.name}</h3>}
          <ul style={{ top: sec.showHead ? HEAD : 0 }}>
            {sec.tiles.map((t) => {
              const it = t.it;
              const n = news[it.stockCode]?.count || 0;
              const w = t.w - GAP;
              const h = t.h - GAP;
              // 글자 폭(em): 한글 0.95, 영문·숫자 0.62 ('LG에너지솔루션'을 한글 8자로 쳐서 칸에 안 들어간다고 숨겼음)
              const len = Math.max(2, [...it.stockName].reduce((t, ch) => t + (/[가-힣]/.test(ch) ? 0.95 : 0.62), 0));
              const nameSize = Math.round(Math.max(10, Math.min(28, (w - 8) / len, h / 2.6)));
              // 이름이 칸 너비에 다 들어갈 때만 (잘린 이름 '삼성엔지니…' 대신 빈 칸 + 마우스를 올리면 정보)
              const showName = w >= 30 && h >= nameSize * 1.2 + 4 && len * nameSize <= w - 4;
              const rateSize = Math.max(10, Math.round(nameSize * 0.72));
              const showRate = showName && h >= nameSize * 1.2 + rateSize * 1.25 + 8 && w >= 44;
              const newsSize = Math.max(12, Math.min(16, Math.round(nameSize * 0.6)));
              const showNews = n > 0 && showRate && h >= nameSize * 1.2 + rateSize * 1.25 + newsSize * 1.6 + 10 && w >= 64;
              // 숫자 동그라미는 이름과 안 겹칠 때만 (이름이 가운데라 양옆에 24px 씩 남아야) — 휴대폰에서 이름을 가렸음
              const showBadge = n > 0 && !showNews && w >= 22 && h >= 18 && (!showName || w - len * nameSize >= 48);
              const limit = it.priceLimit === 'UPPER' ? ' 상한가' : it.priceLimit === 'LOWER' ? ' 하한가' : '';
              const label = `${it.stockName}, ${sec.name}, 시가총액 ${capText(it.marketCap)}, ${fmtRate(it.changeRate)}${limit}, 오늘 기사 ${n}건`;
              return (
                <li key={it.stockCode} style={{ left: t.x, top: t.y, width: w, height: h }}>
                  <Link
                    to={`/stocks/${it.stockCode}`}
                    className={`cm-tile ${capHeat(it.changeRate)}`}
                    aria-label={label}
                    onMouseEnter={() => setTip({ it, sec: sec.name, n, x: sec.x + t.x + w / 2, y: sec.y + (sec.showHead ? HEAD : 0) + t.y + h })}
                    onFocus={() => setTip({ it, sec: sec.name, n, x: sec.x + t.x + w / 2, y: sec.y + (sec.showHead ? HEAD : 0) + t.y + h })}
                    onBlur={() => setTip(null)}
                  >
                    {showName && (
                      <span className="cm-name" style={{ fontSize: nameSize }}>
                        {it.stockName}
                      </span>
                    )}
                    {showRate && (
                      <span className="cm-rate num" style={{ fontSize: rateSize }}>
                        {fmtRate(it.changeRate)}
                        {limit}
                      </span>
                    )}
                    {showNews && (
                      <span className="cm-news num" style={{ fontSize: newsSize }}>
                        기사 {n}건
                      </span>
                    )}
                    {showBadge && (
                      <b className="cm-nbadge num" aria-hidden="true">
                        {n}
                      </b>
                    )}
                    {n > 0 && !showNews && !showBadge && <i className="cm-dot" aria-hidden="true" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {tip && (
        <div className="cm-tip" style={{ left: Math.min(Math.max(8, tip.x - 140), width - 288), top: Math.min(tip.y + 6, height - 8) }} role="presentation">
          <b>{tip.it.stockName}</b> <span className="muted">{tip.sec}</span>
          <div className="num">
            시가총액 {capText(tip.it.marketCap)} · <span className={tip.it.changeRate > 0 ? 'up' : tip.it.changeRate < 0 ? 'down' : ''}>{fmtRate(tip.it.changeRate)}</span>
          </div>
          <div className="num">오늘 기사 {tip.n}건</div>
          {news[tip.it.stockCode]?.top && <div className="cm-tip-title">{news[tip.it.stockCode].top.title}</div>}
        </div>
      )}
    </div>
  );
}

/** 색 범례 + 읽는 법 */
export function CapLegend({ size = '시가총액', grouped = true }) {
  return (
    <div className="cm-legend" aria-hidden="true">
      <span className="cm-scale">
        <i className="cm-d3">-3%</i>
        <i className="cm-d2">-1%</i>
        <i className="cm-d1" />
        <i className="cm-0">0</i>
        <i className="cm-u1" />
        <i className="cm-u2">+1%</i>
        <i className="cm-u3">+3%</i>
      </span>
      <span>
        크기 = {size}
        {grouped ? ' · 묶음 = 업종' : ''} · '기사 n건'·동그라미 숫자 = 오늘 이 종목 기사 수
      </span>
    </div>
  );
}
