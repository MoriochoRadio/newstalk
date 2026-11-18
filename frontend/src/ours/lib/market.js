// 국내 정규장 상태 (한국 시간): 평일 09:00~15:30 = 장중. 공휴일은 모름(달력 데이터 없음) → 평일 공휴일엔 '장중/장 마감'으로 보일 수 있음
// 11/16 MTS PM 리뷰: 가격 옆에 지금 값인지 종가인지 알 수 없었음
// 11/17 QA: 수능일은 10:00~16:30, 새해 첫 거래일은 10:00 개장 (거래소 공지). 백엔드 MarketHours 와 같은 표
const KST_OFFSET = 9 * 3600 * 1000;

/** 장 시간이 다른 날: 'YYYY-MM-DD' → [개장 분, 마감 분] */
const SPECIAL = {
  '2025-11-13': [10 * 60, 16 * 60 + 30], // 2026학년도 수능
  '2026-01-02': [10 * 60, 15 * 60 + 30], // 2026 첫 거래일
  '2026-11-19': [10 * 60, 16 * 60 + 30], // 2027학년도 수능
};

/** 그날 정규장 [개장 분, 마감 분] (한국 시간 날짜 'YYYY-MM-DD') */
export function sessionMinutes(kstDay) {
  return SPECIAL[kstDay] || [9 * 60, 15 * 60 + 30];
}

export function marketState(now = new Date()) {
  const k = new Date(now.getTime() + KST_OFFSET);
  const day = k.getUTCDay();
  const min = k.getUTCHours() * 60 + k.getUTCMinutes();
  const [open, close] = sessionMinutes(k.toISOString().slice(0, 10));
  if (day === 0 || day === 6) return { key: 'closed', label: '휴장' };
  if (min < open) return { key: 'pre', label: '장 시작 전' };
  if (min < close) return { key: 'open', label: '장중' }; // 차트 tradingNow 와 같게 마감 시각부터 마감
  return { key: 'after', label: '장 마감' };
}
