// AI 요약에서 '주가 움직임' 문장을 뺌 (11/16 리뷰: "장 초반 SK하이닉스는 2.38% 하락한 118만7000원에 거래됐다"가
// 머리의 실시간 현재가와 다르고, 앞 문장의 사건 때문에 내린 것처럼 읽힘 — 시세는 화면이 따로 보여 줌)
// 주가 낱말(주가·장 초반·장중·시간외·종가·거래됐) + 퍼센트·원 숫자가 함께 있는 문장만. "영업이익 30% 증가" 같은 실적 문장은 남김
const PRICE_WORD = /(주가|장\s?초반|장중|시간외|종가|거래됐|거래되|상한가|하한가|급등|급락)/;
const NUMBER = /\d[\d,.]*\s*(%|원)/;

// 제목이 주가 움직임 기사인가: 백엔드 ArticleLabels.PRICE_MOVE 와 같은 낱말 (목록 API 는 priceMoveTitle 을 주지만
// 크게 움직인 날 API 는 제목만 줘서 화면에서 같은 규칙으로 가림)
const PRICE_MOVE = /특징주|급등|급락|상한가|하한가|강세|약세|상승|하락|뛰|올랐|내렸|떨어|치솟|곤두박질|반등|폭락|폭등|신고가|52주|매물폭탄|매물 폭탄|매도 폭탄|매도세|매수세|투매|패닉/; // 11/16 밤: 매물폭탄·매도세·투매 등 (백엔드와 같게)
export const isPriceMoveTitle = (title) => PRICE_MOVE.test(String(title || ''));

/** 크게 움직인 날의 대표 기사: 서버가 준 첫 기사(그날 가장 많이 다뤄진 소식부터) + 주가 기사인지.
 *  주가 기사도 대표가 될 수 있고, 그때는 화면이 '주가 기사' 표시를 붙여 원인이 아니라 그날 움직임을 다룬 기사임을 밝힘 (11/16 밤 사용자 결정)
 *  서버가 priceMoveTitle 을 주면 그대로, 옛 서버면 같은 낱말 규칙 */
export function moveLead(move) {
  const a = move?.articles?.[0];
  if (!a) return null;
  return { article: a, isPrice: a.priceMoveTitle !== undefined && a.priceMoveTitle !== null ? a.priceMoveTitle : isPriceMoveTitle(a.title) };
}

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
