// 여러 종목 현재가. 처음엔 GET /api/quotes?codes= (10개씩), live 면 SSE 방송(앞 5종목)으로 계속 갱신
// 시세가 꺼진 서버(503 QUOTE_DISABLED)면 disabled: true → 화면은 가격 칸을 비우고 "시세 준비 중"
import { useCallback, useEffect, useState } from 'react';
import { quoteApi } from '../../api';
import { useQuoteStream } from '../../hooks/useQuoteStream';

const REFRESH_MS = 60_000;
const CHUNK = 10;

export function useQuotes(codes, { live = false } = {}) {
  const key = [...new Set((codes || []).filter(Boolean))].join(',');
  const [state, setState] = useState({ key: '', map: {}, loading: false, disabled: false, failed: false });

  useEffect(() => {
    if (!key) return undefined;
    const list = key.split(',');
    const controller = new AbortController();
    let timer;
    const load = async (first) => {
      if (first) setState((s) => ({ ...s, key, loading: true }));
      const chunks = [];
      for (let i = 0; i < list.length; i += CHUNK) chunks.push(list.slice(i, i + CHUNK));
      const results = await Promise.allSettled(chunks.map((c) => quoteApi.many(c, { signal: controller.signal })));
      if (controller.signal.aborted) return;
      const map = {};
      let disabled = false;
      let failed = false;
      results.forEach((r) => {
        if (r.status === 'fulfilled') (r.value?.items || []).forEach((q) => (map[q.stockCode] = q));
        else if (r.reason?.code === 'QUOTE_DISABLED') disabled = true;
        else if (r.reason?.name !== 'AbortError') failed = true;
      });
      setState((s) => ({ key, map: { ...(s.key === key ? s.map : {}), ...map }, loading: false, disabled, failed }));
      if (!disabled) timer = setTimeout(() => load(false), REFRESH_MS);
    };
    load(true);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [key]);

  const onQuote = useCallback((q) => {
    setState((s) => ({ ...s, map: { ...s.map, [q.stockCode]: q } }));
  }, []);
  useQuoteStream(live && !state.disabled ? key.split(',') : [], onQuote);

  const ready = state.key === key;
  return {
    quotes: ready ? state.map : {},
    loading: !ready || state.loading,
    disabled: ready && state.disabled,
    failed: ready && state.failed,
  };
}
