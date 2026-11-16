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
export default function CapMap({ items, news = {}, height = 520, limit = 20, maxShare = 0.24 }) {
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
    const raw = new Map(list0.map((x) => [x.stockCode, Math.max(1, x.marketCap) ** 0.6]));
    // 칸 하나가 지도의 maxShare 를 넘지 않게 (11/16 사용자: 삼성전자·SK하이닉스 두 칸이 지도 절반) — 크기 순서는 그대로,
    // 넘친 넓이는 나머지에 나눔. c = maxShare × Σmin(w, c) 를 만족하는 상한 c 를 이분 탐색
    const ws = [...raw.values()];
    let capW = Math.max(...ws);
    if (ws.length * maxShare >= 1 && capW > maxShare * ws.reduce((t, v) => t + v, 0)) {
      let lo = 0;
      let hi = capW;
      for (let i = 0; i < 40; i += 1) {
        const mid = (lo + hi) / 2;
        if (mid - maxShare * ws.reduce((t, v) => t + Math.min(v, mid), 0) > 0) hi = mid;
        else lo = mid;
      }
      capW = lo;
    }
    const weightOf = (x) => Math.min(raw.get(x.stockCode), capW);
    // 칸마다 오른쪽·아래 여백(GAP)을 빼므로 전체를 GAP 만큼 크게 나눠야 끝이 상자 끝과 맞음
    const secRects = squarify(sectors.map((s) => s.list.reduce((t, x) => t + weightOf(x), 0)), width + GAP, height + GAP);
    return secRects.map((r) => {
      const s = sectors[r.i];
      const showHead = Boolean(s.name) && r.h >= HEAD + 30 && r.w >= 60;
      const top = showHead ? HEAD : 0;
      const inner = squarify(s.list.map((x) => weightOf(x)), Math.max(0, r.w), Math.max(0, r.h - top));
      return { ...r, name: s.name, showHead, tiles: inner.map((t) => ({ ...t, it: s.list[t.i] })) };
    });
  }, [items, width, height, limit, maxShare]);

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
              const roomy = w >= 130 && h >= 96; // 큰 칸: 증권 앱 지도처럼 왼쪽 위에 이름·등락, 왼쪽 아래 기사 수
              const newsSize = roomy ? Math.max(14, Math.min(17, Math.round(Math.sqrt(w * h) / 16))) : 12; // 기사 줄 글자 (먼저 정함)
              // 이름·등락·기사 세 줄이 칸 높이에 들어가게 이름 크기를 맞춤: 이름 1.2 + 등락 0.9 + 기사 줄 + 여백
              const fitByH = (h - 10 - newsSize * 1.45) / 2.05;
              const nameSize = Math.round(Math.max(10, Math.min(roomy ? Math.min(28, Math.max(18, Math.sqrt(w * h) / 9)) : 18, (w - (roomy ? 24 : 8)) / len, h / 2.8, fitByH)));
              // 이름이 칸 너비에 다 들어갈 때만 (잘린 이름 '삼성엔지니…' 대신 빈 칸 + 마우스를 올리면 정보)
              const showName = w >= 30 && h >= nameSize * 1.2 + 4 && len * nameSize <= w - 4;
              // 좁고 긴 칸: 한 줄에 안 들어가는 긴 이름(한화에어로스페이스 등)은 두세 줄로 접어서 (빈 칸으로 남던 것 — 11/16)
              const wrapSize = Math.round(Math.max(11, Math.min(14, ((w - 8) * 2.6) / len)));
              const wrapName = !showName && w >= 40 && h >= wrapSize * 3.6 + 8;
              const rateSize = Math.max(10, Math.round(nameSize * 0.72));
              const showRate = showName && h >= nameSize * 1.2 + rateSize * 1.25 + 8 && w >= 44;
              // 기사 수 표시 (11/16 사용자: 어떤 칸은 '기사 n건'이 있고 어떤 칸은 없음, 큰 칸만 알약 모양이 없음 → 한 가지 알약으로 통일)
              // 자리가 되면 '기사 n건', 좁으면 'n건', 기사가 없으면 '기사 없음'. 자리 계산: 이름·등락 줄 높이를 뺀 나머지
              const digits = String(n).length;
              const fullW = n > 0 ? newsSize * (2.2 + digits * 0.62 + 0.95) + 20 : newsSize * 3.9 + 20;
              const shortW = newsSize * (digits * 0.62 + 0.95) + 16;
              const wrapLines = wrapName ? Math.ceil((len * wrapSize) / Math.max(1, w - 8)) : 0;
              const usedH = (showName ? nameSize * 1.2 : wrapLines * wrapSize * 1.2) + (showRate ? rateSize * 1.25 : 0);
              const roomV = h - usedH - 8 >= newsSize * 1.4;
              const newsText =
                roomV && fullW <= w - 8 ? (n > 0 ? `기사 ${n}건` : '기사 없음') : roomV && shortW <= w - 8 ? (n > 0 ? `${n}건` : '없음') : null;
              // 세로 자리가 없으면 오른쪽 위 작은 알약 'n건' (이름과 안 겹칠 때만)
              const cornerNews = !newsText && n > 0 && w >= shortW + 8 && h >= 22 && (!showName || w - len * nameSize >= shortW * 2 + 8);
              // 기사가 많을수록 진하게: 없음 회색 · 1~2건 보통 · 3~5건 보라 · 6건 이상 진한 보라
              const newsLevel = n === 0 ? 0 : n >= 6 ? 3 : n >= 3 ? 2 : 1;
              const limit = it.priceLimit === 'UPPER' ? ' 상한가' : it.priceLimit === 'LOWER' ? ' 하한가' : '';
              const label = `${it.stockName}, ${sec.name}, 시가총액 ${capText(it.marketCap)}, ${fmtRate(it.changeRate)}${limit}, 오늘 기사 ${n}건`;
              return (
                <li key={it.stockCode} style={{ left: t.x, top: t.y, width: w, height: h }}>
                  <Link
                    to={`/stocks/${it.stockCode}`}
                    className={`cm-tile ${capHeat(it.changeRate)} ${roomy ? 'cm-roomy' : ''}`}
                    aria-label={label}
                    onMouseEnter={() => setTip({ it, sec: sec.name, n, x: sec.x + t.x + w / 2, y: sec.y + (sec.showHead ? HEAD : 0) + t.y + h })}
                    onFocus={() => setTip({ it, sec: sec.name, n, x: sec.x + t.x + w / 2, y: sec.y + (sec.showHead ? HEAD : 0) + t.y + h })}
                    onBlur={() => setTip(null)}
                  >
                    <span className="cm-main">
                      {showName && (
                        <span className="cm-name" style={{ fontSize: nameSize }}>
                          {it.stockName}
                        </span>
                      )}
                      {wrapName && (
                        <span className="cm-name cm-name-wrap" style={{ fontSize: wrapSize }}>
                          {it.stockName}
                        </span>
                      )}
                      {showRate && (
                        <span className="cm-rate num" style={{ fontSize: rateSize }}>
                          {fmtRate(it.changeRate)}
                          {limit}
                        </span>
                      )}
                    </span>
                    {newsText && (
                      <span className={`cm-news cm-n${newsLevel} num`} style={{ fontSize: newsSize }}>
                        {newsText}
                      </span>
                    )}
                    {cornerNews && (
                      <span className={`cm-news cm-news-corner cm-n${newsLevel} num`} aria-hidden="true">
                        {n}건
                      </span>
                    )}
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
        {grouped ? ' · 묶음 = 업종' : ''} · '기사 n건' = 오늘 이 종목 기사 수 (많을수록 진한 보라)
      </span>
    </div>
  );
}
