// 종목 주가 차트: TradingView Lightweight Charts 5.2.1 (Apache-2.0)로 캔들 + 거래량 + 이동평균
// 바탕: test/fe-ui-redesign 의 StockPriceChart.jsx (커밋 20af518 → 1886a40 이어 받기 → 2fc2813 한국식 시각 → 0bba50e 휠 양보)
// 더한 것: 이동평균 5·20·60 (일·주·월봉), 십자선 값 줄(시·고·저·종·전봉 대비·거래량·이평), 화면 테마(토큰) 색 따라가기
// v2: 기사 나온 때 표시(마커). 일봉 = 최근 30일 날마다 기사 수(언급량 API), 분봉 = 최근 기사 100건의 작성 시각 + 그날 첫 기사.
//     주가 움직임과 나란히 보여 줄 뿐 "때문에"라고 하지 않음
// v3 (11/12 사용자 피드백 "보기 불편하고 사용성이 떨어진다, 점으로 뉴스 시점 표시도 어색"):
//   - 봉 단위 버튼 8개(1분~년) 대신 투자자에게 익숙한 기간 버튼 (오늘·1개월·3개월·6개월·1년·5년), 기본 3개월
//   - 기사 점(마커) 대신 차트 맨 아래 칸에 "그날 기사 수" 막대 → 거래량처럼 읽히는 '뉴스 거래량'. 십자선을 올리면 그날 대표 기사 제목
// 데이터는 우리 백엔드 GET /api/quotes/{code}/chart (원래 KIS). TradingView 서버·데이터는 쓰지 않음
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CandlestickSeries, HistogramSeries, LineSeries, createChart, createSeriesMarkers } from 'lightweight-charts';
import { quoteApi } from '../../api';
import { errorText } from '../lib/errors';
import { fmtRate } from '../lib/format';
import { Segmented } from './ui';
import { marketState } from '../lib/market';

// 기간 버튼: 봉 단위는 기간에서 정함 (bars = 처음 보여 줄 봉 수, 거래일 기준). 오늘 = 5분봉, 5년 = 주봉
// 봉 단위 (11/16 사용자: '1개월' 기본이 불편, 보통 1분·5분·1시간·일로 봄) → 기간 대신 증권 앱처럼 봉 단위로 고름.
// 기간은 끌기·휠로 넓히고 줄임. bars: 처음에 보여 줄 봉 수(없으면 받은 것 전부). 1시간봉은 서버에 없어 30분봉 두 개를 합침
const RANGES = [
  { key: '1m', label: '1분', unit: '1m', bars: 120 },
  { key: '5m', label: '5분', unit: '5m' },
  { key: '30m', label: '30분', unit: '30m', minBars: 40 },
  { key: '60m', label: '60분', unit: '60m', minBars: 30 },
  { key: 'day', label: '일', unit: 'day', bars: 65 },
  { key: 'week', label: '주', unit: 'week', bars: 78 },
  { key: 'month', label: '월', unit: 'month' },
];
const UNIT_KEY = 'snm_chart_unit';
const HIDE_MOVE_MARKS = true;
// 처음 단위: 지난번 고른 것, 없으면 장중엔 5분봉·그 밖엔 일봉
function initialUnit() {
  try {
    const saved = localStorage.getItem(UNIT_KEY);
    if (RANGES.some((r) => r.key === saved)) return saved;
  } catch {
    // 저장소를 못 쓰면 기본값
  }
  return marketState().key === 'open' ? '5m' : 'day';
}
/** 서버에 묻는 단위 (1시간봉은 30분봉으로 받아 합침) */
const apiUnit = (unit) => (unit === '60m' ? '30m' : unit);
/** 30분봉 → 1시간봉: 같은 시(時)끼리 시가=첫 봉, 종가=마지막 봉, 고가·저가=최고·최저, 거래량=합 */
function toHourly(items) {
  const out = [];
  for (const it of items || []) {
    const t = String(it.time);
    const hourKey = t.slice(0, 13);
    const last = out[out.length - 1];
    if (last && last.hourKey === hourKey) {
      last.high = Math.max(last.high, it.high);
      last.low = Math.min(last.low, it.low);
      last.close = it.close;
      last.volume += it.volume;
    } else {
      out.push({ ...it, hourKey, time: `${hourKey}:00:00${(t.match(/(Z|[+-]\d\d:?\d\d)$/) || [''])[0]}` });
    }
  }
  return out.map(({ hourKey, ...rest }) => rest); // eslint-disable-line no-unused-vars
}
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
/** 오늘 봉인가: 일봉은 날짜 문자열, 분봉은 (한국 시각으로 옮긴) 초 → 날짜 */
const isTodayBar = (r, unit) => {
  if (!r) return false;
  const today = kstDate(new Date().toISOString());
  if (unit === 'day') return r.t === today;
  return isIntraday(unit) && typeof r.t === 'number' && new Date(r.t * 1000).toISOString().slice(0, 10) === today;
};
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
    const res = await quoteApi.chart(stockCode, apiUnit(unit), { date: day ?? undefined }, { signal });
    count += 1;
    const answered = res.date || day;
    if (res.items?.length) return { items: unit === '60m' ? toHourly(res.items) : res.items, date: answered, tried: count };
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
    labelBg: pick('--surface-3', '#e9ecef'),
    ink: pick('--text', '#191f28'),
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

// 값 줄의 날짜는 한국어로: '2026-11-16' → '11월 16일 (월)', 올해가 아니면 연도도 (11/16 MTS PM 리뷰: 기계 표기 그대로였음)
// formatTime 은 봉 찾기 비교에도 쓰여 모양을 못 바꿈 → 보여 주기만 따로
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const readoutTime = (t) => {
  let y, m, d, hm = '';
  if (typeof t === 'number') {
    const x = new Date(t * 1000);
    [y, m, d] = [x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate()];
    hm = ` ${pad(x.getUTCHours())}:${pad(x.getUTCMinutes())}`;
  } else if (typeof t === 'object' && t) [y, m, d] = [t.year, t.month, t.day];
  else if (typeof t === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t)) [y, m, d] = t.split('-').map(Number);
  else return String(t);
  const w = WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const thisYear = new Date().getFullYear();
  return `${y !== thisYear ? `${y}년 ` : ''}${m}월 ${d}일 (${w})${hm}`;
};
// 거래량: '9,684,123' → '968만 주' (값 줄은 정확히 읽을 일이 적고 크기만 보면 됨. 1만 주 아래는 그대로)
const volText = (v) => (v == null ? '–' : v >= 1e8 ? `${(v / 1e8).toFixed(2)}억 주` : v >= 1e4 ? `${Math.round(v / 1e4).toLocaleString('ko-KR')}만 주` : `${Math.round(v).toLocaleString('ko-KR')}주`);

// 일봉 기사 수에는 앞 휴일 기사가 합쳐짐 → '이날'이 아니라 '11월 14~16일' (11/16 3차 리뷰: 같은 화면 '오늘 15건'과 27건이 안 맞음)
function dayRangeLabel(prevT, t) {
  if (typeof t !== 'string' || typeof prevT !== 'string') return '이날';
  const start = new Date(`${prevT}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() + 1);
  const s = start.toISOString().slice(0, 10);
  if (s >= t) return '이날';
  const [, sm, sd] = s.split('-').map(Number);
  const [, em, ed] = t.split('-').map(Number);
  return sm === em ? `${sm}월 ${sd}~${ed}일` : `${sm}월 ${sd}일~${em}월 ${ed}일`;
}

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
  const out = Array.from({ length: values.length }, () => null);
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
  const signal = Array.from({ length: rows.length }, () => null);
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

export default function PriceChart({ stockCode, stockName, dayCounts = null, articles = null, moves = null, liveQuote = null }) {
  // 기본 1개월 (11/16 리뷰 두 번: 3개월이면 기사 수 칸(최근 30일)의 왼쪽 2/3가 비어 데이터가 빠진 것처럼 보였음)
  const [rangeKey, setRangeKeyState] = useState(initialUnit);
  const setRangeKey = (k) => {
    setRangeKeyState(k);
    try {
      localStorage.setItem(UNIT_KEY, k);
    } catch {
      // 기억 못 해도 이번 화면은 그대로
    }
  };
  const range = RANGES.find((r) => r.key === rangeKey) || RANGES[4];
  const unit = range.unit;
  const [data, setData] = useState(EMPTY);
  const [reloadN, setReloadN] = useState(0); // 차트를 못 받았을 때 '다시 시도' (11/16 코드 리뷰: 기간을 바꿔도 같은 일봉이라 다시 안 받았음)
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
      layout: { textColor: c.text, background: { color: 'transparent' }, attributionLogo: false, fontFamily: 'Pretendard Variable, Pretendard, system-ui, sans-serif', panes: { separatorColor: c.grid, separatorHoverColor: c.grid } }, // 칸 나눔 선: 어두운 화면에서 흰 선이 튀어서 격자 색으로 (11/16)
      grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
      // entireTextOnly: 칸 끝에서 반쯤 잘리는 눈금 글자는 안 그림 (11/13 QA: 맨 위 '325,000' 이 반만 보였음)
      rightPriceScale: { borderVisible: false, entireTextOnly: true },
      timeScale: { borderVisible: false },
      crosshair: { mode: 0 },
      // 가격 글자 모양은 시리즈마다 (차트 전체 priceFormatter 는 거래량 칸까지 덮어써서 '25,000,000' 이 됐음)
      localization: { locale: 'ko-KR', timeFormatter: formatTime },
      // 그냥 휠은 페이지 스크롤에 양보. 확대는 Ctrl+휠·두 손가락·가격 축 끌기
      handleScroll: { mouseWheel: false, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { mouseWheel: false, pinch: true, axisPressedMouseMove: true, axisDoubleClickReset: true },
    });
    const priceFmt = { type: 'custom', formatter: fmt, minMove: 1 };
    const candles = chart.addSeries(CandlestickSeries, {
      priceFormat: priceFmt,
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
          priceFormat: priceFmt,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        }),
      ])
    );
    // 거래량 눈금: 2,500만·1.2억 처럼 (11/16 리뷰: '25,000,000' 그대로라 읽기 힘듦)
    const volFmt = (v) => (v >= 1e8 ? `${(v / 1e8).toFixed(1)}억` : v >= 1e4 ? `${Math.round(v / 1e4).toLocaleString('ko-KR')}만` : `${Math.round(v)}`);
    const volume = chart.addSeries(HistogramSeries, { priceFormat: { type: 'custom', formatter: volFmt }, priceLineVisible: false, lastValueVisible: false }, 1);
    // 가격 칸 위아래 여백을 줄여 봉이 칸을 더 채우게 (기본 위 20%·아래 10% 라 가운데에 눌려 보였음)
    candles.priceScale().applyOptions({ scaleMargins: { top: 0.08, bottom: 0.08 } });
    // 거래량 칸 위쪽에 여백을 둬서 가격 칸 아래 눈금 글자와 겹치지 않게
    volume.priceScale().applyOptions({ scaleMargins: { top: 0.2, bottom: 0 } });
    // 맨 아래 칸: 그날(그 봉) 기사 수 = 뉴스 거래량 (v3)
    const news = chart.addSeries(
      HistogramSeries,
      { color: c.news, priceFormat: { type: 'custom', formatter: (v) => `${Math.round(v)}건` }, priceLineVisible: false, lastValueVisible: false },
      2
    );
    news.priceScale().applyOptions({ scaleMargins: { top: 0.15, bottom: 0 } });
    chart.panes()[0].setStretchFactor(5); // 가격 칸을 더 크게 (11/16 디자이너 리뷰: 캔들이 납작함)
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

    // 크게 움직인 날 표시(일봉에서만): 오른 날은 봉 아래 ▲, 내린 날은 봉 위 ▼ (11/16 F-17 연결)
    const moveMarks = createSeriesMarkers(candles, []);
    chartRef.current = { chart, candles, volume, news, maSeries, moveMarks, colors: c };

    // 라이트/다크가 바뀌면(<html data-theme> 또는 운영체제 설정) 차트 색도 따라감
    const recolor = () => {
      const n = readColors();
      chart.applyOptions({ layout: { textColor: n.text, panes: { separatorColor: n.grid, separatorHoverColor: n.grid } }, grid: { vertLines: { color: n.grid }, horzLines: { color: n.grid } } });
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
      // 지운 차트의 보조지표·가격선을 붙잡고 있으면 새 차트에 칸이 안 생기고, 끌 때 지운 시리즈를 만져 앱 전체가 멈춤
      // (11/16 코드 리뷰: 개발 모드 StrictMode 에서 MACD 를 켜 둔 채 열면 재현)
      indRef.current = { macd: null, rsi: null };
      hiLoRef.current = [];
      placedKeyRef.current = null;
      shownCountRef.current = 0;
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
    // 30분·1시간봉은 하루가 13·7봉뿐이라 굵은 막대 몇 개만 보였음 → 처음부터 며칠을 이어 받아 minBars 개 이상 (11/16)
    const minBars = RANGES.find((r) => r.unit === unit)?.minBars || 0;
    const first = isIntraday(unit)
      ? fetchIntradayDay(stockCode, unit, null, 0, controller.signal).then(async (r) => {
          let { items, date: cursor } = r;
          const { tried } = r;
          if (minBars && items.length > 0 && items.length < minBars) {
            // 하루 봉 수로 모자란 날 수를 셈 (오늘이 덜 끝났으면 하루치보다 적으므로 넉넉히 +1). 공휴일은 빈 날로 그냥 넘어감
            const perDay = unit === '60m' ? 7 : 13;
            const need = Math.min(6, Math.ceil((minBars - items.length) / perDay) + 1);
            const days = [];
            for (let d = cursor, i = 0; i < need; i += 1) {
              d = prevWeekday(d);
              days.push(d);
            }
            const olders = await Promise.all(
              days.map((d) =>
                quoteApi
                  .chart(stockCode, apiUnit(unit), { date: d }, { signal: controller.signal })
                  .then((res) => (unit === '60m' ? toHourly(res.items || []) : res.items || []))
                  .catch((e) => {
                    if (e.name === 'AbortError') throw e;
                    return []; // 하루 실패는 건너뜀
                  })
              )
            );
            olders.forEach((o) => {
              if (o.length) items = mergeOlder(o, items);
            });
            cursor = days[days.length - 1];
          }
          return { items, cursor, tried, more: items.length > 0 && tried < MAX_INTRADAY_DAYS };
        })
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
      .then((r) => {
        if (controller.signal.aborted) return; // 단위를 바꾼 뒤 늦게 온 결과는 버림
        setData({ key, error: null, ...r });
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setData({ ...EMPTY, key, error: err });
      });
    return () => controller.abort();
  }, [stockCode, unit, key, reloadN]);

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
  // 십자선이 움직일 때마다(setHover) 다시 그려지므로 무거운 계산은 데이터가 바뀔 때만 (11/16 2차 코드 리뷰)
  const rows = useMemo(() => (data.key === key ? data.items.map((it) => ({ ...it, t: toChartTime(it.time, unit) })) : []), [data, key, unit]);
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
      ref.candles.createPriceLine({ price: hi, color: ref.colors.text, lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: '' }),
      ref.candles.createPriceLine({ price: lo, color: ref.colors.text, lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: '' }),
    ];
  }, [data, key, unit, rangeKey, range.bars]);

  // 같은 일봉 안에서 기간만 바꾸면(1개월↔1년) 다시 받지 않고 보이는 범위만 바꿈. 모자라면 왼쪽 끝에서 이전 데이터를 이어 받음
  useEffect(() => {
    const ref = chartRef.current;
    if (!ref || placedKeyRef.current !== key) return;
    showRange(ref.chart.timeScale(), rowsRef.current.length, range.bars);
  }, [rangeKey, key, range.bars]);

  // 오늘 일봉을 실시간 현재가로 고쳐 그림 (값 줄과 차트 봉이 머리의 현재가와 같게)
  const livePrice = liveQuote?.price ?? null;
  useEffect(() => {
    const ref = chartRef.current;
    const last = rowsRef.current[rowsRef.current.length - 1];
    if (!ref || livePrice == null || !isTodayBar(last, unit) || (isIntraday(unit) && !tradingNow())) return;
    ref.candles.update({ time: last.t, open: last.open, high: Math.max(last.high, livePrice), low: Math.min(last.low, livePrice), close: livePrice });
  }, [livePrice, unit, data]);

  // 크게 움직인 날 표시: 받은 봉 안에 있는 날만 (일봉일 때). 다른 단위로 바꾸면 지움
  const movesKey = `${key}:${rows.length}:${(moves || []).map((m) => `${m.date}${m.direction}`).join(',')}`;
  useEffect(() => {
    const ref = chartRef.current;
    if (!ref?.moveMarks) return;
    // 캔들 위 ▲▼ 는 뜻을 알기 어려웠음 (11/16 사용자: '중간중간 화살표는 뭐지?') → 차트에는 그리지 않고 '크게 움직인 날' 카드에서만
    if (HIDE_MOVE_MARKS || unit !== 'day' || !moves?.length) {
      ref.moveMarks.setMarkers([]);
      return;
    }
    const have = new Set(rowsRef.current.map((r) => r.t));
    const marks = moves
      .filter((m) => have.has(m.date))
      .map((m) => {
        const up = m.changeRate > 0;
        return { time: m.date, position: up ? 'belowBar' : 'aboveBar', shape: up ? 'arrowUp' : 'arrowDown', color: up ? ref.colors.up : ref.colors.down, size: 0.5 }; // 작게 (리뷰: 화살표가 캔들을 가림)
      })
      .sort((a, b) => (a.time < b.time ? -1 : 1));
    ref.moveMarks.setMarkers(marks);
  }, [movesKey, unit]); // eslint-disable-line react-hooks/exhaustive-deps

  // 기사 수 막대: 데이터나 기사 목록이 바뀌면 다시 그림
  const marks = useMemo(() => newsByBar(rows, unit, dayCounts, articles), [rows, unit, dayCounts, articles]);
  const marksKey = useMemo(() => `${key}:${rows.length}:${[...marks.entries()].map(([t, m]) => `${t}=${m.count}`).join(',')}`, [key, rows, marks]);
  const macdAll = useMemo(() => (ind.macd && hasMa(unit) ? macd(rows) : null), [ind.macd, unit, rows]);
  const rsiAll = useMemo(() => (ind.rsi && hasMa(unit) ? rsi(rows) : null), [ind.rsi, unit, rows]);
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
  // 오늘 일봉은 위 현재가(실시간 시세)로 맞춤 — 차트 봉은 10분 캐시라 값 줄의 '현재'가 머리의 현재가와 달랐음 (11/16 리뷰)
  const liveBar = (r) =>
    r && r === rows[rows.length - 1] && isTodayBar(r, unit) && (unit === 'day' || tradingNow()) && liveQuote?.price
      ? { ...r, close: liveQuote.price, high: Math.max(r.high, liveQuote.price), low: Math.min(r.low, liveQuote.price) }
      : r;
  const bar = idx >= 0 ? liveBar(rows[idx]) : null;
  const prev = idx > 0 ? rows[idx - 1] : null;
  // 보조지표 값 줄 (십자선이 가리키는 봉)
  const indAt = {
    macd: macdAll && bar ? macdAll[idx] : null,
    rsi: rsiAll && bar ? rsiAll[idx]?.value ?? null : null,
  };
  // 장중의 오늘 일봉은 아직 종가가 아님 → "종" 대신 "현재" (11/13: 장중에 '종 27,650'이 위 현재가와 달라 헷갈림)
  const live = bar && idx === rows.length - 1 && unit === 'day' && bar.t === kstDate(new Date().toISOString()) && tradingNow();
  const diffRate = bar && prev && prev.close ? ((bar.close - prev.close) / prev.close) * 100 : null;
  // 화면 낭독용 한 줄 (11/12 접근성 점검: 차트 값이 마우스·터치로만 보였음) — 고른 기간의 첫 봉과 마지막 봉 종가
  const span = useMemo(() => (range.bars ? rows.slice(-range.bars) : rows), [range.bars, rows]);
  const spanHi = useMemo(() => (span.length ? Math.max(...span.map((r) => r.high)) : null), [span]);
  const spanLo = useMemo(() => (span.length ? Math.min(...span.map((r) => r.low)) : null), [span]);
  const first = span[0];
  const last = span[span.length - 1];
  const chartLabel =
    first && last && first.close
      ? `${stockName} 주가 차트, ${range.label}봉. ${unit === 'day' && last.t === kstDate(new Date().toISOString()) && tradingNow() ? '현재' : '마지막 종가'} ${fmt(last.close)}원, 기간 등락 ${fmtRate(((last.close - first.close) / first.close) * 100)}, 최고 ${fmt(spanHi)}원, 최저 ${fmt(spanLo)}원`
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
        <Segmented label="봉 단위" size="sm" options={RANGES} value={rangeKey} onChange={setRangeKey} />
      </div>

      <div className="chart-readout" aria-live="off">
        {bar && !message ? (
          <>
            <span className="muted">{readoutTime(bar.t)}</span>
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
                  {isIntraday(unit) && <span className="k">전 봉 대비 </span>}
                  {diffRate > 0 ? '+' : ''}
                  {diffRate.toFixed(2)}%
                </span>
              )}
            </span>
            <span>
              <span className="k">거래량</span>
              <b>{volText(bar.volume)}</b>
            </span>
            {/* 기간 최고·최저: 축 위 상자로 두면 눈금 숫자를 가려서(11/16 리뷰) 값 줄로 옮김. 차트에는 점선만 */}
            {!isIntraday(unit) && span.length > 1 && (
              <span className="muted">
                {/* 차트의 점선 두 줄이 이 값이라는 것을 같은 점선 표시로 (11/16 리뷰: 이름 없는 점선) */}
                <i className="hl-swatch" aria-hidden="true" />
                <span className="k">기간 최고</span>
                <b>{fmt(spanHi)}</b>
                <span className="k" style={{ marginLeft: 8 }}>최저</span>
                <b>{fmt(spanLo)}</b>
              </span>
            )}
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
              {unit === 'day' ? '기사 수 막대 = 그날 기사 수 (최근 30일)' : `기사 수 막대 = ${range.label}마다 기사 수 (최근 기사 100건)`}
            </span>
          )}
          {!HIDE_MOVE_MARKS && unit === 'day' && moves?.length > 0 && (
            <a href="#big-moves" className="move-legend">
              <span className="up">▲</span>
              <span className="down">▼</span> 크게 움직인 날
            </a>
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
          <button type="button" className="ind-btn" aria-pressed={ind.rsi} onClick={() => toggleInd('rsi')} title="RSI: 최근 14봉의 오른 폭과 내린 폭 비율. 70 이상이면 많이 오른 편, 30 이하면 많이 내린 편">
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
        {message && (
          <div className="chart-overlay">
            <span>{message}</span>
            {data.error && data.key === key && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setData(EMPTY);
                  setReloadN((n) => n + 1);
                  // 단추가 사라지며 초점이 맨 앞으로 튀지 않게 차트 제목으로 (11/16 2차 코드 리뷰)
                  const h = document.getElementById('chart-title');
                  if (h) {
                    h.setAttribute('tabindex', '-1');
                    h.focus({ preventScroll: true });
                  }
                }}
              >
                다시 시도
              </button>
            )}
          </div>
        )}
      </div>
      {showMarks && bar && !message && (
        <div className="chart-news" aria-live="off">
          {barNews ? (
            <>
              <span className="badge badge-outline num">
                {unit === 'day' ? `${dayRangeLabel(prev?.t, bar.t)} 기사 ${barNews.count}건` : `이 봉 기사 ${barNews.count}건`}
              </span>
              {/* 대표 제목: 이 종목이 주인공인 기사 중 같은 소식(여러 언론이 다룬 수)이 가장 많은 것, 시세 기사·공시는 뒤로
                  (4차 리뷰: '함께 언급' 기사가 대표 / 11/16 밤 액터: 삼성전자 -5.34% 날 대표가 '파트장 은탑훈장' — 가장 최근 기사였음) */}
              {(() => {
                const mainOf = (x) => x.relatedStocks?.find((s) => s.code === stockCode && s.role === 'MAIN');
                const score = (x) => {
                  const m = mainOf(x);
                  if (!m) return -1;
                  return (x.priceMoveTitle || x.isDisclosure ? 0 : 1000) + (m.sameNewsCount || 1);
                };
                // 크게 움직인 날이면 '크게 움직인 날' 카드와 같은 기사 (같은 날 두 칸 제목이 달랐음)
                const move = unit === 'day' && typeof bar.t === 'string' ? (moves || []).find((m) => m.date === bar.t) : null;
                const moveTop = move?.articles?.find((a) => !a.priceMoveTitle) || null;
                if (moveTop) return <Link to={`/news/${moveTop.articleId}`}>{moveTop.title}</Link>;
                const pick = [...barNews.items].sort((a, b) => score(b) - score(a))[0] || barNews.items[0];
                return pick ? <Link to={`/news/${pick.id}`}>{pick.title}</Link> : null;
              })()}
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
