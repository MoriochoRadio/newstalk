// 종목 주가 차트: TradingView Lightweight Charts 5.2.1 (Apache-2.0)로 캔들 + 거래량 + 이동평균
// 바탕: test/fe-ui-redesign 의 StockPriceChart.jsx (커밋 20af518 → 1886a40 이어 받기 → 2fc2813 한국식 시각 → 0bba50e 휠 양보)
// 더한 것: 이동평균 5·20·60 (일·주·월봉), 십자선 값 줄(시·고·저·종·전봉 대비·거래량·이평), 화면 테마(토큰) 색 따라가기
// 데이터는 우리 백엔드 GET /api/quotes/{code}/chart (원래 KIS). TradingView 서버·데이터는 쓰지 않음
import { useEffect, useRef, useState } from 'react';
import { CandlestickSeries, HistogramSeries, LineSeries, createChart } from 'lightweight-charts';
import { quoteApi } from '../../api';
import { errorText } from '../lib/errors';
import { Segmented } from './ui';

const UNITS = [
  { key: '1m', label: '1분' },
  { key: '5m', label: '5분' },
  { key: '10m', label: '10분' },
  { key: '30m', label: '30분' },
  { key: 'day', label: '일' },
  { key: 'week', label: '주' },
  { key: 'month', label: '월' },
  { key: 'year', label: '년' },
];
const MA = [
  { n: 5, color: '--ma5' },
  { n: 20, color: '--ma20' },
  { n: 60, color: '--ma60' },
];
const MA_FALLBACK = { '--ma5': '#e8a317', '--ma20': '#8b5cf6', '--ma60': '#0ea5a4' };
const KST_OFFSET_SEC = 9 * 3600;
const MAX_INTRADAY_DAYS = 5;
const DAY_INITIAL_BARS = 120;
const LOAD_MORE_MARGIN = 10;

const isIntraday = (unit) => unit.endsWith('m');
const hasMa = (unit) => unit === 'day' || unit === 'week' || unit === 'month';

const dayBefore = (ymd) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

const prevWeekday = (ymd) => {
  let d = dayBefore(ymd);
  while ([0, 6].includes(new Date(`${d}T00:00:00Z`).getUTCDay())) d = dayBefore(d);
  return d;
};

/** 분봉 하루치. 빈 날(장 전·주말·공휴일)이면 그 앞 평일로, 합쳐 MAX_INTRADAY_DAYS 번까지 */
async function fetchIntradayDay(stockCode, unit, date, tried, signal) {
  let day = date;
  let count = tried;
  while (count < MAX_INTRADAY_DAYS) {
    const res = await quoteApi.chart(stockCode, unit, { date: day ?? undefined }, { signal });
    count += 1;
    const answered = res.date || day;
    if (res.items?.length) return { items: res.items, date: answered, tried: count };
    day = prevWeekday(answered);
  }
  return { items: [], date: day, tried: count };
}

const mergeOlder = (older, current) => {
  const byTime = new Map();
  [...older, ...current].forEach((it) => byTime.set(it.time, it));
  return [...byTime.values()].sort((a, b) => (a.time > b.time ? 1 : a.time < b.time ? -1 : 0));
};

/** 분봉: 초 단위 숫자 + 9시간 (차트는 UTC 로 그리므로 한국 시각으로 보이게). 일봉 이상: 'YYYY-MM-DD' */
const toChartTime = (iso, unit) =>
  isIntraday(unit) ? Math.floor(new Date(iso).getTime() / 1000) + KST_OFFSET_SEC : String(iso).slice(0, 10);

const readColors = () => {
  const css = getComputedStyle(document.documentElement);
  const pick = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  return {
    up: pick('--up-chart', '#f04452'),
    down: pick('--down-chart', '#3182f6'),
    text: pick('--text-3', '#636e7b'),
    grid: pick('--line', '#e5e8eb'),
    ma: Object.fromEntries(MA.map((m) => [m.n, pick(m.color, MA_FALLBACK[m.color])])),
  };
};

const fmt = (n) => (n == null ? '–' : Math.round(n).toLocaleString('ko-KR'));
const pad = (n) => String(n).padStart(2, '0');

const formatTime = (t) => {
  if (typeof t === 'number') {
    const d = new Date(t * 1000);
    return `${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  }
  if (typeof t === 'object' && t) return `${t.year}-${pad(t.month)}-${pad(t.day)}`;
  return String(t);
};

/** 종가 단순 이동평균. 앞쪽 n-1 개는 값 없음 */
function movingAverage(rows, n) {
  const out = [];
  let sum = 0;
  for (let i = 0; i < rows.length; i += 1) {
    sum += rows[i].close;
    if (i >= n) sum -= rows[i - n].close;
    if (i >= n - 1) out.push({ time: rows[i].t, value: sum / n });
  }
  return out;
}

const EMPTY = { key: null, items: [], error: null, more: false, cursor: null, tried: 0 };

export default function PriceChart({ stockCode, stockName }) {
  const [unit, setUnit] = useState('day');
  const [data, setData] = useState(EMPTY);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(null);
  const [hover, setHover] = useState(null); // 십자선이 가리키는 봉의 시각
  const boxRef = useRef(null);
  const chartRef = useRef(null);
  const dataRef = useRef(data);
  const busyRef = useRef(false);
  const moreAbortRef = useRef(null);
  const placedKeyRef = useRef(null);
  const shownCountRef = useRef(0);
  const loadOlderRef = useRef(() => {});

  // 차트는 한 번만 만들고 데이터만 바꿈
  useEffect(() => {
    const c = readColors();
    const chart = createChart(boxRef.current, {
      autoSize: true,
      layout: { textColor: c.text, background: { color: 'transparent' }, attributionLogo: true, fontFamily: 'Pretendard Variable, Pretendard, system-ui, sans-serif' },
      grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
      crosshair: { mode: 0 },
      localization: { locale: 'ko-KR', priceFormatter: fmt, timeFormatter: formatTime },
      // 그냥 휠은 페이지 스크롤에 양보. 확대는 Ctrl+휠·두 손가락·가격 축 끌기
      handleScroll: { mouseWheel: false, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { mouseWheel: false, pinch: true, axisPressedMouseMove: true, axisDoubleClickReset: true },
    });
    const candles = chart.addSeries(CandlestickSeries, {
      upColor: c.up,
      downColor: c.down,
      borderUpColor: c.up,
      borderDownColor: c.down,
      wickUpColor: c.up,
      wickDownColor: c.down,
    });
    const maSeries = Object.fromEntries(
      MA.map((m) => [
        m.n,
        chart.addSeries(LineSeries, {
          color: c.ma[m.n],
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        }),
      ])
    );
    const volume = chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceLineVisible: false, lastValueVisible: false }, 1);
    // 거래량 칸 위쪽에 여백을 둬서 가격 칸 아래 눈금 글자와 겹치지 않게
    volume.priceScale().applyOptions({ scaleMargins: { top: 0.2, bottom: 0 } });
    chart.panes()[0].setStretchFactor(3);
    chart.panes()[1].setStretchFactor(1);

    chart.subscribeCrosshairMove((param) => setHover(param.time ?? null));
    const onRange = (range) => {
      if (range && range.from < LOAD_MORE_MARGIN) loadOlderRef.current();
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(onRange);

    const box = boxRef.current;
    const onWheel = (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const ts = chart.timeScale();
      const r = ts.getVisibleLogicalRange();
      if (!r) return;
      const span = r.to - r.from;
      const nextSpan = Math.min(2000, Math.max(10, span * (e.deltaY > 0 ? 1.15 : 1 / 1.15)));
      const anchor = ts.coordinateToLogical(e.clientX - box.getBoundingClientRect().left) ?? r.to;
      const from = anchor - ((anchor - r.from) * nextSpan) / span;
      ts.setVisibleLogicalRange({ from, to: from + nextSpan });
    };
    box.addEventListener('wheel', onWheel, { passive: false });

    chartRef.current = { chart, candles, volume, maSeries, colors: c };

    // 라이트/다크가 바뀌면(<html data-theme> 또는 운영체제 설정) 차트 색도 따라감
    const recolor = () => {
      const n = readColors();
      chart.applyOptions({ layout: { textColor: n.text }, grid: { vertLines: { color: n.grid }, horzLines: { color: n.grid } } });
      candles.applyOptions({ upColor: n.up, downColor: n.down, borderUpColor: n.up, borderDownColor: n.down, wickUpColor: n.up, wickDownColor: n.down });
      MA.forEach((m) => maSeries[m.n].applyOptions({ color: n.ma[m.n] }));
      if (chartRef.current) chartRef.current.colors = n;
    };
    const observer = new MutationObserver(recolor);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    media?.addEventListener('change', recolor);

    return () => {
      observer.disconnect();
      media?.removeEventListener('change', recolor);
      box.removeEventListener('wheel', onWheel);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRange);
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  const key = `${stockCode}:${unit}`;
  useEffect(() => {
    if (!stockCode) return undefined;
    const controller = new AbortController();
    moreAbortRef.current?.abort();
    moreAbortRef.current = null;
    busyRef.current = false;
    setLoadingMore(false);
    setMoreError(null);
    setHover(null);
    const first = isIntraday(unit)
      ? fetchIntradayDay(stockCode, unit, null, 0, controller.signal).then((r) => ({
          items: r.items,
          cursor: r.date,
          tried: r.tried,
          more: r.items.length > 0 && r.tried < MAX_INTRADAY_DAYS,
        }))
      : quoteApi.chart(stockCode, unit, {}, { signal: controller.signal }).then((res) => {
          const items = res.items || [];
          return {
            items,
            cursor: items[0] ? String(items[0].time).slice(0, 10) : null,
            tried: 0,
            // 일봉만 이어 받기 (주·월·년봉은 처음 범위가 이미 길다)
            more: unit === 'day' && items.length > 0,
          };
        });
    first
      .then((r) => setData({ key, error: null, ...r }))
      .catch((err) => {
        if (err.name !== 'AbortError') setData({ ...EMPTY, key, error: err });
      });
    return () => controller.abort();
  }, [stockCode, unit, key]);

  loadOlderRef.current = () => {
    const d = dataRef.current;
    if (busyRef.current || !d.more || d.key !== key || d.error) return;
    busyRef.current = true;
    setLoadingMore(true);
    const controller = new AbortController();
    moreAbortRef.current = controller;
    const next = isIntraday(unit)
      ? fetchIntradayDay(stockCode, unit, prevWeekday(d.cursor), d.tried, controller.signal).then((r) => ({
          older: r.items,
          cursor: r.date,
          tried: r.tried,
          more: r.items.length > 0 && r.tried < MAX_INTRADAY_DAYS,
        }))
      : quoteApi.chart(stockCode, unit, { to: dayBefore(d.cursor) }, { signal: controller.signal }).then((res) => {
          const older = res.items || [];
          return { older, cursor: older[0] ? String(older[0].time).slice(0, 10) : d.cursor, tried: 0, more: older.length > 0 };
        });
    next
      .then((r) => {
        setData((prev) =>
          prev.key === key ? { ...prev, items: mergeOlder(r.older, prev.items), cursor: r.cursor, tried: r.tried, more: r.more } : prev
        );
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setMoreError(err);
        setData((prev) => (prev.key === key ? { ...prev, more: false } : prev));
      })
      .finally(() => {
        if (moreAbortRef.current === controller) {
          moreAbortRef.current = null;
          busyRef.current = false;
          setLoadingMore(false);
        }
      });
  };

  // 받은 데이터를 차트에 그림 (+ 이동평균)
  const rows = data.key === key ? data.items.map((it) => ({ ...it, t: toChartTime(it.time, unit) })) : [];
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  useEffect(() => {
    dataRef.current = data;
    const ref = chartRef.current;
    if (!ref || data.key !== key) return;
    const list = rowsRef.current;
    const timeScale = ref.chart.timeScale();
    const added = placedKeyRef.current === key ? list.length - shownCountRef.current : 0;
    const before = added > 0 ? timeScale.getVisibleLogicalRange() : null;
    shownCountRef.current = list.length;
    ref.candles.setData(list.map((r) => ({ time: r.t, open: r.open, high: r.high, low: r.low, close: r.close })));
    ref.volume.setData(
      list.map((r) => ({ time: r.t, value: r.volume, color: `${r.close >= r.open ? ref.colors.up : ref.colors.down}66` }))
    );
    MA.forEach((m) => ref.maSeries[m.n].setData(hasMa(unit) ? movingAverage(list, m.n) : []));
    if (before) timeScale.setVisibleLogicalRange({ from: before.from + added, to: before.to + added });
    if (placedKeyRef.current !== key) {
      placedKeyRef.current = key;
      ref.chart.applyOptions({ timeScale: { timeVisible: isIntraday(unit), secondsVisible: false } });
      if (unit === 'day' && list.length > DAY_INITIAL_BARS) {
        timeScale.setVisibleLogicalRange({ from: list.length - DAY_INITIAL_BARS, to: list.length - 1 });
      } else {
        timeScale.fitContent();
      }
    }
  }, [data, key, unit]);

  const loading = data.key !== key;
  // 값 줄: 십자선이 가리키는 봉(없으면 마지막 봉)과 그 앞 봉
  let idx = rows.length - 1;
  if (hover != null) {
    const found = rows.findIndex((r) => (typeof r.t === 'number' ? r.t === hover : r.t === formatTime(hover) || r.t === hover));
    if (found >= 0) idx = found;
  }
  const bar = idx >= 0 ? rows[idx] : null;
  const prev = idx > 0 ? rows[idx - 1] : null;
  const diffRate = bar && prev && prev.close ? ((bar.close - prev.close) / prev.close) * 100 : null;
  const maAt = (n) => {
    if (!hasMa(unit) || idx < n - 1) return null;
    let s = 0;
    for (let i = idx - n + 1; i <= idx; i += 1) s += rows[i].close;
    return s / n;
  };

  const message = loading
    ? null
    : data.error
      ? data.error.code === 'QUOTE_DISABLED'
        ? '이 서버는 시세 기능이 꺼져 있어요.'
        : `차트를 불러오지 못했어요. ${errorText(data.error)}`
      : data.items.length === 0
        ? isIntraday(unit)
          ? `최근 ${MAX_INTRADAY_DAYS}영업일 분봉이 없어요. 일봉으로 보세요.`
          : '보여 줄 시세가 없어요.'
        : null;
  let moreStatus = '';
  if (!loading && !message) {
    if (loadingMore) moreStatus = '이전 데이터를 받는 중…';
    else if (moreError) moreStatus = '이전 데이터를 받지 못했어요';
    else if (!data.more && isIntraday(unit)) moreStatus = `분봉은 최근 ${MAX_INTRADAY_DAYS}영업일까지`;
    else if (!data.more && unit === 'day') moreStatus = '상장 이후 전부';
  }
  const colors = chartRef.current?.colors || null;

  return (
    <section className="card" aria-labelledby="chart-title">
      <div className="chart-top">
        <h2 className="card-title" id="chart-title">
          주가 차트
        </h2>
        <Segmented label="봉 단위" size="sm" options={UNITS} value={unit} onChange={setUnit} />
      </div>

      <div className="chart-readout" aria-live="off">
        {bar && !message ? (
          <>
            <span className="muted">{formatTime(bar.t)}</span>
            <span>
              <span className="k">시</span>
              <b>{fmt(bar.open)}</b>
            </span>
            <span>
              <span className="k">고</span>
              <b className="up">{fmt(bar.high)}</b>
            </span>
            <span>
              <span className="k">저</span>
              <b className="down">{fmt(bar.low)}</b>
            </span>
            <span>
              <span className="k">종</span>
              <b>{fmt(bar.close)}</b>
              {diffRate != null && (
                <span className={diffRate > 0 ? 'up' : diffRate < 0 ? 'down' : 'flat'} style={{ marginLeft: 4 }}>
                  {diffRate > 0 ? '+' : ''}
                  {diffRate.toFixed(2)}%
                </span>
              )}
            </span>
            <span>
              <span className="k">거래량</span>
              <b>{fmt(bar.volume)}</b>
            </span>
          </>
        ) : (
          <span>&nbsp;</span>
        )}
      </div>
      {hasMa(unit) && bar && !message && (
        <div className="chart-legend num">
          {MA.map((m) => (
            <span key={m.n}>
              <i style={{ background: colors?.ma[m.n] || MA_FALLBACK[m.color] }} />
              이동평균 {m.n} {maAt(m.n) != null ? fmt(maAt(m.n)) : '–'}
            </span>
          ))}
        </div>
      )}

      <div className="chart-box">
        <div ref={boxRef} className="chart-canvas" role="img" aria-label={`${stockName} 주가 차트`} />
        {loading && (
          <div className="chart-skeleton" role="status" aria-label="차트를 받는 중">
            {[38, 52, 46, 64, 58, 72, 66, 80, 74, 62, 70, 84, 78, 90, 82, 68, 76, 88, 72, 60].map((h, i) => (
              <div key={i} className="skeleton" style={{ height: `${h}%` }} />
            ))}
          </div>
        )}
        {message && <div className="chart-overlay">{message}</div>}
      </div>
      <div className="chart-foot">
        <span>{hasMa(unit) ? '이동평균은 종가 기준' : ''}</span>
        <span aria-live="polite">{moreStatus}</span>
      </div>
    </section>
  );
}
