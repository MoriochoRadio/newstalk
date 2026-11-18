// 계정 찾기 확인 질문 목록 (GET /api/auth/recovery/questions). 한 번 받으면 이 창에서 계속 씀
import { useEffect, useState } from 'react';
import { authApi } from '../../api';

let cached = null;
let pending = null;

export function useQuestions() {
  const [list, setList] = useState(cached || []);
  useEffect(() => {
    if (cached) return undefined;
    let alive = true;
    pending = pending || authApi.questions().then((r) => (cached = Array.isArray(r) ? r : []));
    pending
      .then((r) => alive && setList(r))
      .catch(() => {
        pending = null; // 다음에 열 때 다시 받음
      });
    return () => {
      alive = false;
    };
  }, []);
  return list;
}
