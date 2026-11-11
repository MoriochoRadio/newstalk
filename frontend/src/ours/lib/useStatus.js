// 데이터 상태(GET /api/status)를 화면 여러 곳(위 줄 상태 표시·홈 숫자)이 한 번만 불러 나눠 씀. 1분마다 새로
import { useEffect, useState } from 'react';
import { statusApi } from '../../api';

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
    const t = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  return state;
}

/** 수집이 살아 있나: 마지막 수집이 성공했고 뉴스 수집이 20분 안이면 true */
export function isLive(s, now = Date.now()) {
  if (!s?.newsCollectedAt) return false;
  if (s.lastRun?.status === 'FAILED') return false;
  return now - new Date(s.newsCollectedAt).getTime() < 20 * 60 * 1000;
}
