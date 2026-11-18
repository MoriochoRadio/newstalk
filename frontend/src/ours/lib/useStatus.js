// 데이터 상태(GET /api/status)를 화면 여러 곳(위 줄 상태 표시·홈 숫자)이 한 번만 불러 나눠 씀. 1분마다 새로
import { useEffect, useState } from 'react';
import { statusApi } from '../../api';
import { REFRESH_EVENT } from '../../hooks/useApi';

const FRESH_MS = 30_000;
const REFRESH_MS = 60_000;
let shared = { data: null, at: 0, promise: null };

function fetchShared() {
  if (shared.data && Date.now() - shared.at < FRESH_MS) return Promise.resolve(shared.data);
  if (!shared.promise) {
    shared.promise = statusApi
      .get()
      .then((data) => {
        shared = { data, at: Date.now(), promise: null };
        return data;
      })
      .catch((err) => {
        shared.promise = null;
        throw err;
      });
  }
  return shared.promise;
}

export function useStatus() {
  const [state, setState] = useState({ data: shared.data, error: null });
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetchShared()
        .then((data) => alive && setState({ data, error: null }))
        .catch((error) => alive && setState((s) => ({ ...s, error })));
    load();
    // 숨긴 탭에선 쉬고, 다시 보이면 바로 한 번 (11/17 QA)
    const t = setInterval(() => !document.hidden && load(), REFRESH_MS);
    const onVisible = () => !document.hidden && load();
    document.addEventListener('visibilitychange', onVisible);
    // '새로 불러오기': 30초 안에 받은 값도 다시
    const onRefresh = () => {
      shared.at = 0;
      load();
    };
    window.addEventListener(REFRESH_EVENT, onRefresh);
    return () => {
      alive = false;
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener(REFRESH_EVENT, onRefresh);
    };
  }, []);
  return state;
}

/** 수집이 살아 있나: 뉴스 수집이 20분 안이면 true
 *  v3 (11/12): 마지막 한 차례 실패(인터넷 끊김 등)만으로 '멈춤'이라 하지 않음 — 수집기는 5분 뒤 다시 시도함 */
export function isLive(s, now = Date.now()) {
  if (!s?.newsCollectedAt) return false;
  return now - new Date(s.newsCollectedAt).getTime() < 20 * 60 * 1000;
}
