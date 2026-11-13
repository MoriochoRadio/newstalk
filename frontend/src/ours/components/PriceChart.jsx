// 종목 주가 차트: TradingView Lightweight Charts 5.2.1 (Apache-2.0)로 캔들 + 거래량 + 이동평균
// 바탕: test/fe-ui-redesign 의 StockPriceChart.jsx (커밋 20af518 → 1886a40 이어 받기 → 2fc2813 한국식 시각 → 0bba50e 휠 양보)
// 더한 것: 이동평균 5·20·60 (일·주·월봉), 십자선 값 줄(시·고·저·종·전봉 대비·거래량·이평), 화면 테마(토큰) 색 따라가기
// v2: 기사 나온 때 표시(마커). 일봉 = 최근 30일 날마다 기사 수(언급량 API), 분봉 = 최근 기사 100건의 작성 시각 + 그날 첫 기사.
//     주가 움직임과 나란히 보여 줄 뿐 "때문에"라고 하지 않음
// v3 (11/12 사용자 피드백 "보기 불편하고 사용성이 떨어진다, 점으로 뉴스 시점 표시도 어색"):
//   - 봉 단위 버튼 8개(1분~년) 대신 투자자에게 익숙한 기간 버튼 (오늘·1개월·3개월·6개월·1년·5년), 기본 3개월
//   - 기사 점(마커) 대신 차트 맨 아래 칸에 "그날 기사 수" 막대 → 거래량처럼 읽히는 '뉴스 거래량'. 십자선을 올리면 그날 대표 기사 제목
// 데이터는 우리 백엔드 GET /api/quotes/{code}/chart (원래 KIS). TradingView 서버·데이터는 쓰지 않음
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CandlestickSeries, HistogramSeries, LineSeries, createChart } from 'lightweight-charts';
import { quoteApi } from '../../api';
import { errorText } from '../lib/errors';
import { fmtRate } from '../lib/format';
import { Segmented } from './ui';

// 기간 버튼: 봉 단위는 기간에서 정함 (bars = 처음 보여 줄 봉 수, 거래일 기준). 오늘 = 5분봉, 5년 = 주봉
const RANGES = [
  { key: 'today', label: '오늘', unit: '5m' },
  { key: '1m', label: '1개월', unit: 'day', bars: 22 },
  { key: '3m', label: '3개월', unit: 'day', bars: 65 },
  { key: '6m', label: '6개월', unit: 'day', bars: 130 },
  { key: '1y', label: '1년', unit: 'day', bars: 250 },
  { key: '5y', label: '5년', unit: 'week' },
];
const MA = [
  { n: 5, color: '--ma5' },
  { n: 20, color: '--ma20' },
  { n: 60, color: '--ma60' },
];
const MA_FALLBACK = { '--ma5': '#a16207', '--ma20': '#7c3aed', '--ma60': '#0d9488' };
const KST_OFFSET_SEC = 9 * 3600;
const MAX_INTRADAY_DAYS = 5;
const LOAD_MORE_MARGIN = 10;

const isIntraday = (unit) => unit.endsWith('m');

/** 오른쪽 끝(최근)부터 bars 개를 보여 줌. bars 가 없으면(오늘·5년) 전부 */
function showRange(timeScale, total, bars) {
  if (!total) return;
  if (bars) timeScale.setVisibleLogicalRange({ from: total - bars, to: total - 1 + 2 });
  else timeScale.fitContent();
}
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
    news: pick('--buzz-solid', '#6d28d9'),
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

/* ===== 보조지표 (11/13 페르소나 '상훈': 차트를 열심히 보는 사용자는 이동평균만으론 부족 — MACD·RSI 를 켜고 끔) =====
 * 받은 봉의 종가로 화면에서 계산 (서버 변경 없음). 일반적인 기본값: MACD(12, 26, 9), RSI(14, Wilder 평균) */
function ema(values, n) {
  const k = 2 / (n + 1);
  const out = new Array(values.length).fill(null);
  let prev = null;
  for (let i = 0; i < values.length; i += 1) {
    if (i < n - 1) continue;
    prev = prev == null ? values.slice(i - n + 1, i + 1).reduce((a, b) => a + b, 0) / n : values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

export function macd(rows, fast = 12, slow = 26, sig = 9) {
  const closes = rows.map((r) => r.close);
  const f = ema(closes, fast);
  const s = ema(closes, slow);
  const line = closes.map((_, i) => (f[i] != null && s[i] != null ? f[i] - s[i] : null));
  const start = line.findIndex((v) => v != null);
  const signal = new Array(rows.length).fill(null);
  if (start >= 0) ema(line.slice(start), sig).forEach((v, j) => (signal[start + j] = v));
  return rows.map((r, i) => ({ time: r.t, macd: line[i], signal: signal[i], hist: line[i] != null && signal[i] != null ? line[i] - signal[i] : null }));
}

export function rsi(rows, n = 14) {
  const out = rows.map((r) => ({ time: r.t, value: null }));
  let gain = 0;
  let loss = 0;
  for (let i = 1; i < rows.length; i += 1) {
    const d = rows[i].close - rows[i - 1].close;
    const g = Math.max(d, 0);
    const l = Math.max(-d, 0);
    if (i <= n) {
      gain += g / n;
      loss += l / n;
      if (i < n) continue;
    } else {
      gain = (gain * (n - 1) + g) / n;
      loss = (loss * (n - 1) + l) / n;
    }
    out[i].value = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return out;
}

const IND_KEY = 'snm_chart_ind';
const readInd = () => {
  try {
    return { macd: false, rsi: false, ...JSON.parse(localStorage.getItem(IND_KEY) || '{}') };
  } catch {
    return { macd: false, rsi: false };
  }
};

const EMPTY = { key: null, items: [], error: null, more: false, cursor: null, tried: 0 };

/**
 * 봉마다 기사 묶기. 일봉: dayCounts[{ date, count }] 를 그날(주말·휴일이면 다음 거래일) 봉에. 분봉: 기사 시각이 들어가는 봉에
 * 돌려주는 값: Map(봉 시각 → { count, items: [기사], first })
 */
function newsByBar(rows, unit, dayCounts, articles) {
  const out = new Map();
  if (!rows.length) return out;
  const add = (t, n, a, first = false) => {
    const cur = out.get(t) || { count: 0, items: [], first: false };
    cur.count += n;
    if (a) cur.items.push(a);
    cur.first = cur.first || first;
    out.set(t, cur);
  };
  if (unit === 'day') {
    const dates = rows.map((r) => r.t);
    const barOf = (ymd) => dates.find((d) => d >= ymd);
    (dayCounts || []).forEach((d) => {
      if (!d.count) return;
      const t = barOf(d.date);
      if (t) add(t, d.count, null);
    });
    (articles || []).forEach((a) => {
      const t = barOf(kstDate(a.publishedAtIso));
      if (t && out.has(t)) out.get(t).items.push(a);
    });
  } else if (isIntraday(unit)) {
    const times = rows.map((r) => r.t);
    const firstOfDay = new Map();
    [...(articles || [])].reverse().forEach((a) => {
      const day = kstDate(a.publishedAtIso);
      if (!firstOfDay.has(day)) firstOfDay.set(day, a.id);
    });
    // 같은 날 봉에만 붙임: 장 시작 전 기사는 그날 첫 봉에, 장 마감 뒤 기사는 표시하지 않음
    const step = (parseInt(unit, 10) || 1) * 60;
    const byDay = new Map();
    times.forEach((t) => {
      const day = new Date(t * 1000).toISOString().slice(0, 10);
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day).push(t);
    });
    (articles || []).forEach((a) => {
      const sec = Math.floor(new Date(a.publishedAtIso).getTime() / 1000) + KST_OFFSET_SEC;
      const bars = byDay.get(kstDate(a.publishedAtIso));
      if (!bars || sec >= bars[bars.length - 1] + step) return;
      let t = bars[0];
      for (const x of bars) {
        if (x <= sec) t = x;
        else break;
      }
      add(t, 1, a, firstOfDay.get(kstDate(a.publishedAtIso)) === a.id);
    });
  }
  return out;
}

const kstDate = (iso) => new Date(new Date(iso).getTime() + KST_OFFSET_SEC * 1000).toISOString().slice(0, 10);

/** 지금 정규장(평일 09:00~15:30, 한국 시간)인가. 공휴일은 모름 → 공휴일엔 오늘 봉 자체가 없어 영향 없음 */
function tradingNow(now = new Date()) {
  const k = new Date(now.getTime() + KST_OFFSET_SEC * 1000);
  const day = k.getUTCDay();
  const min = k.getUTCHours() * 60 + k.getUTCMinutes();
  return day >= 1 && day <= 5 && min >= 9 * 60 && min < 15 * 60 + 30;
}

export default function PriceChart({ stockCode, stockName, dayCounts = null, articles = null }) {
  const [rangeKey, setRangeKey] = useState('3m');
  const range = RANGES.find((r) => r.key === rangeKey) || RANGES[2];
  const unit = range.unit;
  const [data, setData] = useState(EMPTY);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(null);
  const [hover, setHover] = useState(null); // 십자선이 가리키는 봉의 시각
  const [ind, setInd] = useState(readInd); // 보조지표 켜고 끔 (이 브라우저에 기억)
  const toggleInd = (k) =>
    setInd((p) => {
      const next = { ...p, [k]: !p[k] };
      try {
        localStorage.setItem(IND_KEY, JSON.stringify(next));
      } catch {
        /* 저장 못 해도 이번 화면에선 동작 */
      }
      return next;
    });
  const indRef = useRef({ macd: null, rsi: null });
  const hiLoRef = useRef([]);
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
    // 맨 아래 칸: 그날(그 봉) 기사 수 = 뉴스 거래량 (v3)
    const news = chart.addSeries(
      HistogramSeries,
      { color: c.news, priceFormat: { type: 'custom', formatter: (v) => `${Math.round(v)}건` }, priceLineVisible: false, lastValueVisible: false },
      2
    );
    news.priceScale().applyOptions({ scaleMargins: { top: 0.15, bottom: 0 } });
    chart.panes()[0].setStretchFactor(4);
    chart.panes()[1].setStretchFactor(1);
    chart.panes()[2].setStretchFactor(1);

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

    chartRef.current = { chart, candles, volume, news, maSeries, colors: c };

    // 라이트/다크가 바뀌면(<html data-theme> 또는 운영체제 설정) 차트 색도 따라감
    const recolor = () => {
      const n = readColors();
      chart.applyOptions({ layout: { textColor: n.text }, grid: { vertLines: { color: n.grid }, horzLines: { color: n.grid } } });
      candles.applyOptions({ upColor: n.up, downColor: n.down, borderUpColor: n.up, borderDownColor: n.down, wickUpColor: n.up, wickDownColor: n.down });
      MA.forEach((m) => maSeries[m.n].applyOptions({ color: n.ma[m.n] }));
      news.applyOptions({ color: n.news });
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
      showRange(timeScale, list.length, range.bars);
    }
  }, [data, key, unit, range.bars]);

  // 보조지표 칸: 켜면 맨 아래에 칸을 만들고, 끄면 칸까지 지움. 일·주봉에서만 (분봉은 하루치라 의미가 작음)
  useEffect(() => {
    const ref = chartRef.current;
    if (!ref) return;
    const { chart } = ref;
    const c = ref.colors;
    const cur = indRef.current;
    const want = { macd: ind.macd && hasMa(unit), rsi: ind.rsi && hasMa(unit) };
    const drop = (series) => {
      const idx = series[0].getPane().paneIndex();
      const before = chart.panes().length;
      series.forEach((s) => chart.removeSeries(s));
      if (chart.panes().length === before) chart.removePane(idx); // 빈 칸이 저절로 지워지지 않았을 때만
    };
    if (!want.macd && cur.macd) {
      drop([cur.macd.hist, cur.macd.line, cur.macd.signal]);
      cur.macd = null;
    }
    if (!want.rsi && cur.rsi) {
      drop([cur.rsi.line]);
      cur.rsi = null;
    }
    const lineOpt = { lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false };
    if (want.macd && !cur.macd) {
      const p = chart.panes().length;
      const hist = chart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false }, p);
      const line = chart.addSeries(LineSeries, { ...lineOpt, color: c.ma[20] }, p);
      const signal = chart.addSeries(LineSeries, { ...lineOpt, color: c.ma[5] }, p);
      chart.panes()[p].setStretchFactor(1.3);
      cur.macd = { hist, line, signal };
    }
    if (want.rsi && !cur.rsi) {
      const p = chart.panes().length;
      const line = chart.addSeries(LineSeries, { ...lineOpt, color: c.ma[60] }, p);
      [70, 30].forEach((v) => line.createPriceLine({ price: v, color: c.text, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: '' }));
      chart.panes()[p].setStretchFactor(1);
      cur.rsi = { line };
    }
    const list = rowsRef.current;
    if (cur.macd) {
      const m = macd(list);
      cur.macd.hist.setData(m.filter((x) => x.hist != null).map((x) => ({ time: x.time, value: x.hist, color: `${x.hist >= 0 ? c.up : c.down}88` })));
      cur.macd.line.setData(m.filter((x) => x.macd != null).map((x) => ({ time: x.time, value: x.macd })));
      cur.macd.signal.setData(m.filter((x) => x.signal != null).map((x) => ({ time: x.time, value: x.signal })));
    }
    if (cur.rsi) cur.rsi.line.setData(rsi(list).filter((x) => x.value != null));
  }, [ind, data, key, unit]);

  // 고른 기간의 최고가·최저가 가로 점선 (지지·저항을 가늠하는 출발점. 직접 선 긋기 도구는 없음)
  useEffect(() => {
    const ref = chartRef.current;
    if (!ref) return;
    hiLoRef.current.forEach((l) => ref.candles.removePriceLine(l));
    hiLoRef.current = [];
    const list = rowsRef.current;
    const span = range.bars ? list.slice(-range.bars) : list;
    if (isIntraday(unit) || span.length < 2) return;
    const hi = Math.max(...span.map((r) => r.high));
    const lo = Math.min(...span.map((r) => r.low));
    hiLoRef.current = [
      ref.candles.createPriceLine({ price: hi, color: ref.colors.text, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: '기간 최고' }),
      ref.candles.createPriceLine({ price: lo, color: ref.colors.text, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: '기간 최저' }),
    ];
  }, [data, key, unit, rangeKey, range.bars]);

  // 같은 일봉 안에서 기간만 바꾸면(1개월↔1년) 다시 받지 않고 보이는 범위만 바꿈. 모자라면 왼쪽 끝에서 이전 데이터를 이어 받음
  useEffect(() => {
    const ref = chartRef.current;
    if (!ref || placedKeyRef.current !== key) return;
    showRange(ref.chart.timeScale(), rowsRef.current.length, range.bars);
  }, [rangeKey, key, range.bars]);

  // 기사 수 막대: 데이터나 기사 목록이 바뀌면 다시 그림
  const marks = newsByBar(rows, unit, dayCounts, articles);
  const marksKey = `${key}:${rows.length}:${[...marks.entries()].map(([t, m]) => `${t}=${m.count}`).join(',')}`;
  const marksRef = useRef(marks);
  marksRef.current = marks;
  useEffect(() => {
    const ref = chartRef.current;
    if (!ref) return;
    // 모든 봉에 값을 줌 (기사가 없으면 0) → 막대 칸의 시간축이 가격 칸과 같게
    ref.news.setData(rowsRef.current.map((r) => ({ time: r.t, value: marksRef.current.get(r.t)?.count || 0 })));
  }, [marksKey, unit]);

  const loading = data.key !== key;
  // 값 줄: 십자선이 가리키는 봉(없으면 마지막 봉)과 그 앞 봉
  let idx = rows.length - 1;
  if (hover != null) {
    const found = rows.findIndex((r) => (typeof r.t === 'number' ? r.t === hover : r.t === formatTime(hover) || r.t === hover));
    if (found >= 0) idx = found;
  }
  const bar = idx >= 0 ? rows[idx] : null;
  const prev = idx > 0 ? rows[idx - 1] : null;
  // 보조지표 값 줄 (십자선이 가리키는 봉)
  const indAt = {
    macd: ind.macd && hasMa(unit) && bar ? macd(rows)[idx] : null,
    rsi: ind.rsi && hasMa(unit) && bar ? rsi(rows)[idx]?.value ?? null : null,
  };
  // 장중의 오늘 일봉은 아직 종가가 아님 → "종" 대신 "현재" (11/13: 장중에 '종 27,650'이 위 현재가와 달라 헷갈림)
  const live = bar && idx === rows.length - 1 && unit === 'day' && bar.t === kstDate(new Date().toISOString()) && tradingNow();
  const diffRate = bar && prev && prev.close ? ((bar.close - prev.close) / prev.close) * 100 : null;
  // 화면 낭독용 한 줄 (11/12 접근성 점검: 차트 값이 마우스·터치로만 보였음) — 고른 기간의 첫 봉과 마지막 봉 종가
  const span = range.bars ? rows.slice(-range.bars) : rows;
  const first = span[0];
  const last = span[span.length - 1];
  const chartLabel =
    first && last && first.close
      ? `${stockName} 주가 차트, ${range.label}. ${unit === 'day' && last.t === kstDate(new Date().toISOString()) && tradingNow() ? '현재' : '마지막 종가'} ${fmt(last.close)}원, 기간 등락 ${fmtRate(((last.close - first.close) / first.close) * 100)}, 최고 ${fmt(Math.max(...span.map((r) => r.high)))}원, 최저 ${fmt(Math.min(...span.map((r) => r.low)))}원`
      : `${stockName} 주가 차트`;
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
  const barNews = bar ? marks.get(bar.t) : null;
  const showMarks = unit === 'day' || isIntraday(unit);

  return (
    <section className="card" aria-labelledby="chart-title">
      <div className="chart-top">
        <h2 className="card-title" id="chart-title">
          주가 차트
        </h2>
        <Segmented label="기간" size="sm" options={RANGES} value={rangeKey} onChange={setRangeKey} />
      </div>

      <div className="chart-readout" aria-live="off">
        {bar && !message ? (
          <>
            <span className="muted">{formatTime(bar.t)}</span>
            <span>
              <span className="k">시가</span>
              <b>{fmt(bar.open)}</b>
            </span>
            <span>
              <span className="k">고가</span>
              <b className="up">{fmt(bar.high)}</b>
            </span>
            <span>
              <span className="k">저가</span>
              <b className="down">{fmt(bar.low)}</b>
            </span>
            <span>
              <span className="k">{live ? '현재' : '종가'}</span>
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
      {bar && !message && (hasMa(unit) || showMarks) && (
        <div className="chart-legend num">
          {hasMa(unit) &&
            MA.map((m) => (
              <span key={m.n}>
                <i style={{ background: colors?.ma[m.n] || MA_FALLBACK[m.color] }} />
                {m.n}{unit === 'week' ? '주' : unit === 'month' ? '개월' : '일'} 평균 {maAt(m.n) != null ? fmt(maAt(m.n)) : '–'}
              </span>
            ))}
          {showMarks && (dayCounts || articles) && (
            <span>
              <i className="news-dot" />
              {unit === 'day' ? '기사 수 막대 = 그날 기사 수 (최근 30일)' : '기사 수 막대 = 5분마다 기사 수 (최근 기사 100건)'}
            </span>
          )}
          {hasMa(unit) && ind.macd && indAt.macd && (
            <span>
              MACD(12,26,9) {fmt(indAt.macd.macd)} · 시그널 {fmt(indAt.macd.signal)}
            </span>
          )}
          {hasMa(unit) && ind.rsi && indAt.rsi != null && <span>RSI(14) {Math.round(indAt.rsi)}</span>}
        </div>
      )}
      {hasMa(unit) && (
        <div className="chart-ind" role="group" aria-label="보조지표">
          <span className="muted">보조지표</span>
          <button type="button" className="ind-btn" aria-pressed={ind.macd} onClick={() => toggleInd('macd')} title="MACD: 짧은 평균과 긴 평균의 차이로 흐름이 바뀌는지 보는 지표 (12·26·9)">
            MACD
          </button>
          <button type="button" className="ind-btn" aria-pressed={ind.rsi} onClick={() => toggleInd('rsi')} title="RSI: 최근 14봉의 오른 폭과 내린 폭 비율. 70 위는 많이 오른 편, 30 아래는 많이 내린 편">
            RSI
          </button>
        </div>
      )}

      <div className="chart-box" data-ind={hasMa(unit) ? (ind.macd ? 1 : 0) + (ind.rsi ? 1 : 0) : 0}>
        <div ref={boxRef} className="chart-canvas" role="img" aria-label={chartLabel} />
        {loading && (
          <div className="chart-skeleton" role="status">
            <span className="sr-only">차트를 받는 중…</span>
            {[38, 52, 46, 64, 58, 72, 66, 80, 74, 62, 70, 84, 78, 90, 82, 68, 76, 88, 72, 60].map((h, i) => (
              <div key={i} className="skeleton" style={{ height: `${h}%` }} />
            ))}
          </div>
        )}
        {message && <div className="chart-overlay">{message}</div>}
      </div>
      {showMarks && bar && !message && (
        <div className="chart-news" aria-live="off">
          {barNews ? (
            <>
              <span className="badge badge-outline num">
                {unit === 'day' ? `이날 기사 ${barNews.count}건` : `이 봉 기사 ${barNews.count}건`}
              </span>
              {barNews.items[0] && <Link to={`/news/${barNews.items[0].id}`}>{barNews.items[0].title}</Link>}
            </>
          ) : (
            <span className="muted">{hover != null ? '이 봉에는 연결된 기사가 없어요' : ''}</span>
          )}
        </div>
      )}
      <div className="chart-foot">
        <span>
          {unit === 'day'
            ? '주말·휴일 기사는 다음 거래일에 표시 · 이동평균은 종가 기준'
            : isIntraday(unit)
              ? '장 시작 전 기사는 그날 첫 봉에 표시'
              : hasMa(unit)
                ? '이동평균은 종가 기준'
                : ''}
        </span>
        <span aria-live="polite">{moreStatus}</span>
      </div>
    </section>
  );
}
