// 요약 없는 기사(제목만 연결)의 이유 (11/17 4차 리뷰: 요약이 없으면 모두 '약관상'이라 했는데, 비즈워치(접속 차단)·
// 파이낸셜뉴스(본문 받기 실패) 기사도 있어 사실과 달랐음). 약관 언론사 목록 = ai/hk_llm/core/press_policy.py 의 TITLE_ONLY·EXCLUDED
export const TERMS_PRESSES = ['연합뉴스', '서울경제', '연합인포맥스', '아주경제'];

export const isTermsPress = (press) => TERMS_PRESSES.includes(String(press || '').trim());

/** 줄에 붙이는 설명 (마우스·화면 낭독기용) */
export function titleOnlyReason(press) {
  return isTermsPress(press)
    ? `${press}는 기사에 'AI 학습 및 활용 금지'를 적어 둬서 본문을 받지 않고 AI 요약·판단을 하지 않아요. 종목은 제목으로 찾았어요.`
    : '본문을 받지 못해 AI 요약·판단 없이 제목으로만 종목을 찾았어요.';
}
