// 조사 '이/가'·'을/를' 고르기 (11/16 QA: 검색 결과 "'없는말'가 들어간 글"처럼 받침이 있어도 '가'가 붙었음)
// 한글: 마지막 글자 받침 여부. 숫자: 읽는 소리(0영 1일 3삼 6육 7칠 8팔 = 받침). 영문: l·m·n·ng 로 끝나면 받침으로 봄(대략)
const HAS_FINAL_DIGIT = new Set(['0', '1', '3', '6', '7', '8']);

export function hasFinal(word) {
  const s = String(word || '').trim();
  if (!s) return false;
  const ch = s[s.length - 1];
  const code = ch.charCodeAt(0) - 0xac00;
  if (code >= 0 && code <= 11171) return code % 28 !== 0;
  if (/\d/.test(ch)) return HAS_FINAL_DIGIT.has(ch);
  return /(?:[lmn]|ng|le)$/i.test(s);
}

/** '반도체' → '가', '없는말' → '이' */
export const iGa = (word) => (hasFinal(word) ? '이' : '가');
