import { useEffect, useState } from 'react';

const APP_NAME = 'StockNews';

/** 브라우저 탭 제목 "삼성전자 · StockNews" */
export function useTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : `${APP_NAME} · 뉴스로 보는 종목`;
  }, [title]);
}

/** 값이 ms 동안 바뀌지 않으면 그 값을 돌려줌 (검색어 입력 중 요청을 줄임) */
export function useDebounced(value, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** 화면 폭이 기준 이하인가 (모바일 배치) */
export function useMedia(query) {
  const get = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false);
  const [match, setMatch] = useState(get);
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const m = window.matchMedia(query);
    const on = () => setMatch(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [query]);
  return match;
}
