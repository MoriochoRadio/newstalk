// API 하나를 불러 { data, error, loading, reload } 로 돌려주는 작은 도구
import { useEffect, useState } from 'react';

const keyOf = (deps) => {
  try {
    return JSON.stringify(deps);
  } catch {
    return String(deps);
  }
};

/**
 * fetcher(signal) 이 Promise 를 돌려주면 그 결과를 data 로. deps 가 바뀌면 다시 부르고 이전 요청은 취소
 * refreshMs 를 주면 그 간격마다 다시 부름 (예: 데이터 상태 1분마다). enabled 가 false 면 부르지 않음
 *
 * 11/17 QA: deps 가 바뀌면(검색어·기간) 새 결과가 올 때까지 이전 결과가 새 제목 아래 그대로 보였음
 * (이전 검색이 1종목이면 그 종목 소식까지 엉뚱하게 불렀음) → 받은 결과에 deps 열쇠를 붙여, 열쇠가 다르면 비우고 '불러오는 중'.
 * 같은 deps 의 주기적 새로 고침은 이전 결과를 둔 채로 바꿈 (깜빡이지 않게).
 * 탭이 숨겨져 있으면 주기적 새로 고침을 쉬고, 다시 보이면 한 번 부름
 */
export function useApi(fetcher, deps, { refreshMs, enabled = true } = {}) {
  const key = keyOf(deps);
  const [state, setState] = useState({ data: null, error: null, loading: enabled, key });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    setState((prev) => (prev.key === key ? { ...prev, loading: true } : { data: null, error: null, loading: true, key }));
    fetcher(controller.signal)
      .then((data) => setState({ data, error: null, loading: false, key }))
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setState((prev) => (prev.key === key ? { ...prev, error: err, loading: false } : { data: null, error: err, loading: false, key }));
        }
      });
    return () => controller.abort();
    // fetcher 는 매번 새 함수라 넣지 않음. 다시 부를 조건은 deps 로만 정함
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick, enabled]);

  useEffect(() => {
    if (!refreshMs || !enabled) return undefined;
    let missed = false;
    const timer = setInterval(() => {
      if (document.hidden) missed = true;
      else setTick((t) => t + 1);
    }, refreshMs);
    const onVisible = () => {
      if (!document.hidden && missed) {
        missed = false;
        setTick((t) => t + 1);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refreshMs, enabled]);

  // deps 가 막 바뀐 그 그리기(효과가 돌기 전)에도 이전 결과를 내보내지 않음
  const view = state.key === key ? state : { data: null, error: null, loading: enabled };
  return { data: view.data, error: view.error, loading: view.loading, reload: () => setTick((t) => t + 1) };
}
