// 평소 대비 보도량: 오늘 기사 수 ÷ 최근 하루 평균(오늘 제외)
// 재료: GET /api/stocks/{code}/mentions?period=7d → 오늘 포함 7일(하루 단위). 앞 6일 평균과 마지막 칸(오늘)을 비교
// 오늘은 아직 하루가 안 끝났으므로 배수는 "지금까지" 기준 (밤에 볼수록 커질 수 있음)
// 평균이 1건 미만이면 배수가 부풀려 보이므로 배수 대신 문장으로

export function buzzOf(mentions) {
  const items = mentions?.items || [];
  if (items.length < 2) return null;
  const today = items[items.length - 1].totalCount;
  const past = items.slice(0, -1);
  const avg = past.reduce((s, p) => s + p.totalCount, 0) / past.length;
  if (today <= 0) return { today, avg, ratio: null, level: 0, text: '오늘 기사 없음' };
  if (avg < 1) {
    return { today, avg, ratio: null, level: today >= 3 ? 2 : 1, text: '평소엔 거의 없던 보도' };
  }
  const ratio = today / avg;
  const level = ratio >= 3 ? 3 : ratio >= 1.5 ? 2 : ratio >= 0.7 ? 1 : 0;
  const text = ratio >= 1.5 ? `평소의 ${ratio.toFixed(1)}배` : ratio >= 0.7 ? '평소 수준' : '평소보다 적음';
  return { today, avg, ratio, level, text };
}

export const BUZZ_TIP = '오늘 이 종목 기사 수를 최근 6일(오늘 제외) 하루 평균과 비교했어요. 오늘은 지금까지 나온 기사 기준이에요.';
