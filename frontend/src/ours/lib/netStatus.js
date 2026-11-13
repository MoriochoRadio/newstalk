// 서버 연결 상태 (11/13 일반 사용자 눈으로: 연결이 끊기면 카드마다 같은 긴 오류가 6~7번 반복되고 위 상태 표시는 정상처럼 보였음)
// → 카드의 오류 상자가 '연결 실패'(fetch 자체 실패 = TypeError)를 받으면 끊김으로 표시하고, 화면 맨 위 띠 하나가 알림
import { useEffect, useState } from 'react';
import { statusApi } from '../../api';

let offline = false;
let recovered = false; // 끊겼다가 다시 연결됨 → '새로 불러오기' 권함
const listeners = new Set();
let timer = null;

function emit() {
  listeners.forEach((fn) => fn({ offline, recovered }));
}

/** fetch 자체가 실패한 오류인가 (서버 꺼짐·인터넷 끊김). 서버가 답한 오류(4xx·5xx)는 아님 */
export const isNetworkError = (err) => err instanceof TypeError;

export function markOffline() {
  if (offline) return;
  offline = true;
  recovered = false;
  emit();
  // 끊긴 동안 10초마다 다시 확인 (가벼운 상태 API)
  clearInterval(timer);
  timer = setInterval(() => {
    statusApi
      .get()
      .then(() => {
        clearInterval(timer);
        offline = false;
        recovered = true;
        emit();
      })
      .catch(() => {});
  }, 10_000);
}

export function useNetStatus() {
  const [s, setS] = useState({ offline, recovered });
  useEffect(() => {
    listeners.add(setS);
    return () => listeners.delete(setS);
  }, []);
  return s;
}
