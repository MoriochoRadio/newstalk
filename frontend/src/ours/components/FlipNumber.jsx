// 클래식 플립 시계 숫자 (11/16 저녁 사용자: "착착 바뀌는 시계처럼, 동적이면서 과하지 않게")
// - 자리마다 카드 한 장. 값이 바뀐 자리만 위 반쪽이 아래로 넘어가며 새 숫자가 나옴 (0.6초)
// - 움직임 줄이기 설정이면 넘기지 않고 바로 바뀜. 화면 낭독기는 전체 숫자 한 번만 읽음
import { useEffect, useRef, useState } from 'react';

function FlipDigit({ d }) {
  const [cur, setCur] = useState(d);
  const [prev, setPrev] = useState(d);
  const [flip, setFlip] = useState(0);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return undefined;
    }
    if (d === cur) return undefined;
    setPrev(cur);
    setCur(d);
    setFlip((n) => n + 1);
    return undefined;
  }, [d]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <span className="flip-digit" aria-hidden="true">
      {/* 바탕: 위 반쪽 = 새 숫자, 아래 반쪽 = 옛 숫자 → 넘김이 끝나면 아래도 새 숫자 */}
      <span className="fd-top">{cur}</span>
      <span className="fd-bottom">{flip ? prev : cur}</span>
      {flip > 0 && (
        <>
          <span key={`a${flip}`} className="fd-flap-top">
            {prev}
          </span>
          <span key={`b${flip}`} className="fd-flap-bottom" onAnimationEnd={() => setPrev(cur)}>
            {cur}
          </span>
        </>
      )}
    </span>
  );
}

export default function FlipNumber({ value, minDigits = 3 }) {
  const s = String(Math.max(0, Math.round(value || 0))).padStart(minDigits, ' ');
  return (
    <span className="flip-number num" role="text" aria-label={`${value}`}>
      {[...s].map((ch, i) =>
        ch === ' ' ? (
          <span key={`s${s.length - i}`} className="flip-digit flip-blank" aria-hidden="true" />
        ) : (
          // 자리는 오른쪽부터 셈 (자릿수가 늘어도 1의 자리 카드는 그대로)
          <FlipDigit key={`d${s.length - i}`} d={ch} />
        )
      )}
    </span>
  );
}
