// AI 요약에서 '주가 움직임' 문장을 뺌 (11/16 리뷰: "장 초반 SK하이닉스는 2.38% 하락한 118만7000원에 거래됐다"가
// 머리의 실시간 현재가와 다르고, 앞 문장의 사건 때문에 내린 것처럼 읽힘 — 시세는 화면이 따로 보여 줌)
// 주가 낱말(주가·장 초반·장중·시간외·종가·거래됐) + 퍼센트·원 숫자가 함께 있는 문장만. "영업이익 30% 증가" 같은 실적 문장은 남김
const PRICE_WORD = /(주가|장\s?초반|장중|시간외|종가|거래됐|거래되|상한가|하한가|급등|급락)/;
const NUMBER = /\d[\d,.]*\s*(%|원)/;

// 제목이 주가 움직임 기사인가: 백엔드 ArticleLabels.PRICE_MOVE 와 같은 낱말 (목록 API 는 priceMoveTitle 을 주지만
// 크게 움직인 날 API 는 제목만 줘서 화면에서 같은 규칙으로 가림)
const PRICE_MOVE = /특징주|급등|급락|상한가|하한가|강세|약세|상승|하락|뛰|올랐|내렸|떨어|치솟|곤두박질|반등|폭락|폭등|신고가|52주/;
export const isPriceMoveTitle = (title) => PRICE_MOVE.test(String(title || ''));

export function isPriceSentence(s) {
  return PRICE_WORD.test(s) && NUMBER.test(s);
}

/** 문장 단위로 나눠 주가 문장을 뺀 글. 다 빠지면 원문 그대로 (요약이 통째로 사라지지 않게) */
export function dropPriceSentences(text) {
  if (!text) return text;
  const parts = String(text).split(/(?<=다\.)\s+/);
  const kept = parts.filter((p) => !isPriceSentence(p));
  return kept.length ? kept.join(' ') : text;
}
