// 국내 정규장 상태 (한국 시간): 평일 09:00~15:30 = 장중. 공휴일은 모름(달력 데이터 없음) → 평일 공휴일엔 '장중/장 마감'으로 보일 수 있음
// 11/16 MTS PM 리뷰: 가격 옆에 지금 값인지 종가인지 알 수 없었음
const KST_OFFSET = 9 * 3600 * 1000;

export function marketState(now = new Date()) {
  const k = new Date(now.getTime() + KST_OFFSET);
  const day = k.getUTCDay();
  const min = k.getUTCHours() * 60 + k.getUTCMinutes();
  if (day === 0 || day === 6) return { key: 'closed', label: '휴장' };
  if (min < 9 * 60) return { key: 'pre', label: '장 시작 전' };
  if (min <= 15 * 60 + 30) return { key: 'open', label: '장중' };
  return { key: 'after', label: '장 마감' };
}
