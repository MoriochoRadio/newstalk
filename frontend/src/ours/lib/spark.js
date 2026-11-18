// 작은 추세선(스파크라인)용 최근 일봉 종가. GET /api/quotes/{code}/chart?unit=day (백엔드가 KIS 에 물음)
// KIS 초당 한도를 지키려고: 한 번에 4개까지만 부르고(나머지는 줄 서기), 받은 것은 메모리에 두고 다시 쓰고,
// 화면에서 사라진 종목은 줄에서 빼서 부르지 않음. 실패하면 그 종목 추세선은 그냥 안 그림
import { quoteApi } from '../../api';

const MAX_ACTIVE = 4; // 11/13: 백엔드가 KIS 호출을 동시에(줄 서기는 그대로) 하게 되어 2 → 4
const DAYS = 20;

const cache = new Map(); // code → { status: 'queued'|'loading'|'done'|'failed', data, wanted, listeners:Set }
const queue = [];
let active = 0;

function pump() {
  while (active < MAX_ACTIVE && queue.length > 0) {
    const code = queue.shift();
    const entry = cache.get(code);
    if (!entry || entry.status !== 'queued') continue;
    if (entry.wanted <= 0) {
      cache.delete(code); // 아무도 안 보면 부르지 않음 (다음에 보이면 다시 줄 섬)
      continue;
    }
    entry.status = 'loading';
    active += 1;
    quoteApi
      .chart(code, 'day')
      .then((res) => {
        const rows = (res?.items || []).slice(-DAYS);
        entry.data = rows.length >= 2 ? rows.map((r) => r.close) : null;
        // 화제 종목 카드의 미니 캔들용 (11/18): 시가·고가·저가·종가·거래량. 작은 흐름선은 종가만 씀
        entry.ohlc = entry.data ? rows.map((r) => ({ o: r.open, h: r.high, l: r.low, c: r.close, v: r.volume || 0 })) : null;
        entry.status = entry.data ? 'done' : 'failed';
      })
      .catch(() => {
        entry.status = 'failed';
        entry.failedAt = Date.now(); // 연결 실패만 1분 뒤 다시 (데이터가 모자란 종목은 다시 물어도 같음)
      })
      .finally(() => {
        active -= 1;
        entry.listeners.forEach((fn) => fn(entry));
        pump();
      });
  }
}

/** code 의 종가 목록을 원함. onChange(entry) 로 알려 줌. 돌려준 함수를 부르면 "이제 안 봄" */
export function wantSpark(code, onChange) {
  let entry = cache.get(code);
  // 잠깐 끊겼다 돌아오면 흐름선이 화면을 새로 고칠 때까지 계속 비어 있었음 → 1분 지난 실패는 다시 줄 세움 (11/16 코드 리뷰)
  if (entry?.failedAt && Date.now() - entry.failedAt > 60_000 && entry.wanted === 0) {
    cache.delete(code);
    entry = null;
  }
  if (!entry) {
    entry = { status: 'queued', data: null, wanted: 0, listeners: new Set() };
    cache.set(code, entry);
    queue.push(code);
  }
  entry.wanted += 1;
  entry.listeners.add(onChange);
  if (entry.status === 'done' || entry.status === 'failed') onChange(entry);
  else pump();
  return () => {
    entry.wanted -= 1;
    entry.listeners.delete(onChange);
  };
}

/** 지금 몇 개를 부르는 중인가 (점검용) */
export const sparkActive = () => active;
