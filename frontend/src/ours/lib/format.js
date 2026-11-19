// 화면 표기 도구 (숫자·시각). 시각은 모두 한국 시간 기준

const KST_MS = 9 * 3600 * 1000;
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const pad = (n) => String(n).padStart(2, '0');

/** Date → 한국 시간의 연·월·일·시·분 (브라우저 시간대와 상관없이) */
function kstParts(date) {
  const d = new Date(date.getTime() + KST_MS);
  return {
    y: d.getUTCFullYear(),
    m: d.getUTCMonth() + 1,
    d: d.getUTCDate(),
    h: d.getUTCHours(),
    min: d.getUTCMinutes(),
    w: d.getUTCDay(),
  };
}

/** 오늘 날짜 "11월 11일 (수)" */
export function todayLabel(now = new Date()) {
  const p = kstParts(now);
  return `${p.m}월 ${p.d}일 (${WEEK[p.w]})`;
}

/**
 * 서버가 '오늘 기사가 없어 가장 최근 날'로 넘어가 보낸 날짜면 "11월 18일 (화)", 오늘이거나 없으면 null
 * (이슈 순위·종합 요약 응답의 date, PR #131. 화면이 '오늘'이라고 적힌 자리에 어제 것을 보여 주던 것을 막음)
 */
export function staleDayLabel(date, now = new Date()) {
  if (!date) return null;
  const p = kstParts(now);
  if (date === `${p.y}-${pad(p.m)}-${pad(p.d)}`) return null;
  const [y, m, d] = String(date).split('-').map(Number);
  if (!y || !m || !d) return null;
  const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${m}월 ${d}일 (${WEEK[w]})`;
}

const sameKstDay = (a, b) => {
  const x = kstParts(a);
  const y = kstParts(b);
  return x.y === y.y && x.m === y.m && x.d === y.d;
};

/** 글 시각: 오늘이면 "14:32", 올해면 "11월 9일 14:32", 그 전이면 "2025. 10. 3." */
export function shortTime(iso, now = new Date()) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const p = kstParts(date);
  if (sameKstDay(date, now)) return `${pad(p.h)}:${pad(p.min)}`;
  if (p.y === kstParts(now).y) return `${p.m}월 ${p.d}일 ${pad(p.h)}:${pad(p.min)}`;
  return `${p.y}. ${p.m}. ${p.d}.`;
}

/** 자세한 시각 "2026년 11월 11일 (수) 14:32" */
export function fullTime(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const p = kstParts(date);
  return `${p.y}년 ${p.m}월 ${p.d}일 (${WEEK[p.w]}) ${pad(p.h)}:${pad(p.min)}`;
}

/** 얼마 전: "방금", "3분 전", "2시간 전", 하루가 넘으면 shortTime */
export function relativeTime(iso, now = new Date()) {
  if (!iso) return '';
  const date = new Date(iso);
  const diff = (now.getTime() - date.getTime()) / 1000;
  if (Number.isNaN(diff)) return '';
  if (diff < 60) return '방금';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400 && sameKstDay(date, now)) return `${Math.floor(diff / 3600)}시간 전`;
  return shortTime(iso, now);
}

/** 가격 205000 → "205,000" */
export function fmtPrice(n) {
  if (n == null || Number.isNaN(Number(n))) return '–';
  return Math.round(Number(n)).toLocaleString('ko-KR');
}

/** 거래량 큰 수 → "1,526만" */
export function fmtVolume(n) {
  if (n == null) return '–';
  if (n >= 1e8) return `${(n / 1e8).toFixed(1)}억`;
  if (n >= 1e4) return `${Math.round(n / 1e4).toLocaleString('ko-KR')}만`;
  return Math.round(n).toLocaleString('ko-KR');
}

/** 등락률 3.07 → "+3.07%", -1.2 → "-1.20%" */
export function fmtRate(rate) {
  if (rate == null || Number.isNaN(Number(rate))) return '–';
  const r = Number(rate);
  const sign = r > 0 ? '+' : r < 0 ? '-' : '';
  return `${sign}${Math.abs(r).toFixed(2)}%`;
}

/** 등락 금액 6100 → "+6,100" */
export function fmtAmount(n) {
  if (n == null) return '';
  const sign = n > 0 ? '+' : n < 0 ? '-' : '';
  return `${sign}${Math.abs(Math.round(n)).toLocaleString('ko-KR')}`;
}

/** 등락 방향 → 글자색 클래스 (up 빨강 · down 파랑 · flat) */
export function dirClass(rate) {
  if (rate == null) return 'flat';
  return rate > 0 ? 'up' : rate < 0 ? 'down' : 'flat';
}

/**
 * 받침이 있나 (조사 고르기: 삼성전자"예요" / NHN"이에요"). 한글이면 받침으로, 영문·숫자면 읽는 소리로 대충 가름
 */
export function hasBatchim(word) {
  const ch = String(word || '').trim().slice(-1);
  if (!ch) return false;
  const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0;
  if (/[0-9]/.test(ch)) return '013678'.includes(ch);
  return /[lmnrLMNR]/.test(ch);
}

/** "삼성전자예요" · "NHN이에요" */
export const iyeyo = (word) => `${word}${hasBatchim(word) ? '이에요' : '예요'}`;

/** 시장 이름을 한글로 (11/13 페르소나 수아: 주식 초보는 KOSPI 보다 '코스피'가 익숙) */
const MARKET_KO = { KOSPI: '코스피', KOSDAQ: '코스닥', KONEX: '코넥스' };
export const marketKo = (m) => (m ? MARKET_KO[m] || m : '');
