// 화제 종목 카드의 '오늘' 미니 차트용 당일 5분봉. GET /api/quotes/{code}/chart?unit=5m (백엔드가 KIS 에 묻고 캐시)
// 같은 종목은 한 번만 부르고 2분 동안 다시 씀. 한 번에 2개까지만 부름 (카드는 많아야 8개)
import { quoteApi } from '../../api';

const MAX_ACTIVE = 2;
const FRESH_MS = 120_000;
const cache = new Map(); // code → { status, data, at, listeners:Set }
const queue = [];
let active = 0;

function pump() {
  while (active < MAX_ACTIVE && queue.length > 0) {
    const code = queue.shift();
    const e = cache.get(code);
    if (!e || e.status !== 'queued') continue;
    if (e.listeners.size === 0 && !e.data) {
      cache.delete(code); // 아무도 안 보면 부르지 않음
      continue;
    }
    e.status = 'loading';
    active += 1;
    quoteApi
      .chart(code, '5m')
      .then((res) => {
        const rows = res?.items || [];
        if (rows.length >= 2) {
          e.data = { date: res.date, rows: rows.map((r) => ({ t: new Date(r.time).getTime(), o: r.open, c: r.close })) };
          e.status = 'done';
        } else {
          e.status = e.data ? 'done' : 'failed';
        }
      })
      .catch(() => {
        e.status = e.data ? 'done' : 'failed'; // 다시 받다 실패하면 옛 값을 계속 보여 줌
      })
      .finally(() => {
        e.at = Date.now();
        active -= 1;
        e.listeners.forEach((fn) => fn(e));
        pump();
      });
  }
}

/** code 의 당일 5분봉을 원함. 2분 지난 값이면 다시 부름(그동안 옛 값). 돌려준 함수를 부르면 "이제 안 봄" */
export function wantIntraday(code, onChange) {
  let e = cache.get(code);
  if (e && (e.status === 'done' || e.status === 'failed') && Date.now() - e.at > FRESH_MS) {
    e.status = 'queued';
    queue.push(code);
  }
  if (!e) {
    e = { status: 'queued', data: null, at: 0, listeners: new Set() };
    cache.set(code, e);
    queue.push(code);
  }
  e.listeners.add(onChange);
  if (e.data || e.status === 'failed') onChange(e);
  pump();
  return () => e.listeners.delete(onChange);
}
