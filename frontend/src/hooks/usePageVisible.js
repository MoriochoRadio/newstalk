// 탭이 보이는가 (11/17 QA): 숨긴 탭에서도 시세 조회·실시간 방송이 계속 돌아 서버의 생중계 자리(KIS 구독 41개)와 조회 한도를 썼음
// 잠깐 다른 탭을 보는 정도로 끊고 다시 붙지 않게, 숨긴 지 hideAfterMs 가 지나야 false. 다시 보이면 바로 true
import { useEffect, useState } from 'react';

const isVisible = () => typeof document === 'undefined' || !document.hidden;

export function usePageVisible(hideAfterMs = 30_000) {
  const [visible, setVisible] = useState(isVisible);
  useEffect(() => {
    let timer;
    const onChange = () => {
      clearTimeout(timer);
      if (isVisible()) setVisible(true);
      else timer = setTimeout(() => setVisible(isVisible()), hideAfterMs);
    };
    document.addEventListener('visibilitychange', onChange);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onChange);
    };
  }, [hideAfterMs]);
  return visible;
}
