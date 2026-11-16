// 여러 종목 현재가. GET /api/quotes?codes= (10개씩), live 면 SSE 방송(앞 5종목)으로 계속 갱신
// 시세가 꺼진 서버(503 QUOTE_DISABLED)면 disabled: true → 화면은 가격 칸을 비우고 "시세 준비 중"
//
// 11/13 로딩 개선: 화면마다 따로 받고, 종목이 늘 때마다(이슈 → 소식 → 관심 종목) 받던 것을 버리고 처음부터 다시 받던 것을
// → 앱 전체가 함께 쓰는 보관함(1분). 이미 받은 종목은 바로 보이고, 받는 중인 종목은 다시 부르지 않고, 새로 늘어난 종목만 받음
import { useCallback, useEffect, useMemo, useReducer } from 'react';
import { quoteApi } from '../../api';
import { useQuoteStream } from '../../hooks/useQuoteStream';

const REFRESH_MS = 60_000;
const CHUNK = 10;

const cache = new Map(); // code → { q, at }
const inflight = new Set();
const failedAt = new Map(); // code → 실패 시각 (15초 동안 다시 부르지 않고 '–')
// 실패는 15초 뒤 다시: 1분 동안 빈칸으로 남아 고장처럼 보였음 (11/16 3차 리뷰). 받은 값은 그대로 1분
const FAIL_RETRY_MS = 15_000;
const failCount = new Map(); // code → 연속 실패 횟수
const listeners = new Set();
let disabled = false;

const emit = () => listeners.forEach((f) => f());

function fetchCodes(codes) {
  const need = codes.filter((c) => !inflight.has(c));
  if (!need.length || disabled) return;
  need.forEach((c) => inflight.add(c));
  for (let i = 0; i < need.length; i += CHUNK) {
    const chunk = need.slice(i, i + CHUNK);
    // 묶음마다 도착하는 대로 화면에 (앞 묶음 = 화면 위쪽 종목이 먼저)
    quoteApi
      .many(chunk)
      .then((res) => {
        const now = Date.now();
        (res?.items || []).forEach((q) => {
          cache.set(q.stockCode, { q, at: now });
          failCount.delete(q.stockCode);
        });
        chunk.filter((c) => !cache.has(c)).forEach((c) => {
          failedAt.set(c, now);
          failCount.set(c, (failCount.get(c) || 0) + 1);
        });
      })
      .catch((e) => {
        if (e?.code === 'QUOTE_DISABLED') disabled = true;
        else
          chunk.forEach((c) => {
            failedAt.set(c, Date.now());
            failCount.set(c, (failCount.get(c) || 0) + 1);
          });
      })
      .finally(() => {
        chunk.forEach((c) => inflight.delete(c));
        emit();
      });
  }
}

const isFresh = (c, now) => {
  const e = cache.get(c);
  if (e && now - e.at < REFRESH_MS) return true;
  const f = failedAt.get(c);
  // 실패가 이어지면 15초 → 30초 → 60초로 간격을 늘림 (시세 서버가 막혔을 때 30종목을 15초마다 다시 부르지 않게)
  return Boolean(f && now - f < Math.min(REFRESH_MS, FAIL_RETRY_MS * 2 ** Math.max(0, (failCount.get(c) || 1) - 1)));
};

export function useQuotes(codes, { live = false } = {}) {
  const key = [...new Set((codes || []).filter(Boolean))].join(',');
  const [version, bump] = useReducer((x) => x + 1, 0);

  useEffect(() => {
    listeners.add(bump);
    return () => listeners.delete(bump);
  }, []);

  useEffect(() => {
    if (!key) return undefined;
    const list = key.split(',');
    const run = () => {
      const now = Date.now();
      fetchCodes(list.filter((c) => !isFresh(c, now)));
    };
    run();
    const timer = setInterval(run, FAIL_RETRY_MS); // 신선한 값은 건너뛰므로 실제 호출은 실패·1분 지난 종목만
    return () => clearInterval(timer);
  }, [key]);

  const onQuote = useCallback((q) => {
    cache.set(q.stockCode, { q, at: Date.now() });
    emit();
  }, []);
  useQuoteStream(live && !disabled ? key.split(',') : [], onQuote);

  return useMemo(() => {
    const list = key ? key.split(',') : [];
    const quotes = {};
    let pending = false;
    for (const c of list) {
      const e = cache.get(c);
      if (e) quotes[c] = e.q;
      else if (!failedAt.has(c)) pending = true;
    }
    return { quotes, loading: !disabled && pending, disabled, failed: list.some((c) => !cache.has(c) && failedAt.has(c)) };
  }, [key, version]); // eslint-disable-line react-hooks/exhaustive-deps
}
