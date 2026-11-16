// 평소 대비 보도량: 오늘 기사 수 ÷ 최근 하루 평균(오늘 제외)
// 재료: GET /api/stocks/{code}/mentions?period=7d → 오늘 포함 7일(하루 단위). 앞 6일 평균과 마지막 칸(오늘)을 비교
// 오늘은 아직 하루가 안 끝났으므로 배수는 "지금까지" 기준 (밤에 볼수록 커질 수 있음)
// 평균이 1건 미만이면 배수가 부풀려 보이므로 배수 대신 문장으로

export function buzzOf(mentions) {
  const items = mentions?.items || [];
  if (items.length < 2) return null;
  const today = items[items.length - 1].totalCount;
  // 평일은 평일끼리: 기사가 적은 주말이 평균에 섞이면 월요일 배수가 부풀려짐 (11/16 PM 2차 리뷰: 삼성SDI '평소의 5.3배')
  const dow = (it) => new Date(`${String(it.time).slice(0, 10)}T12:00:00Z`).getUTCDay();
  const weekday = (it) => dow(it) >= 1 && dow(it) <= 5;
  const before = items.slice(0, -1);
  const sameKind = before.filter((it) => weekday(it) === weekday(items[items.length - 1]));
  const past = sameKind.length >= 2 ? sameKind : before;
  const avg = past.reduce((s, p) => s + p.totalCount, 0) / past.length;
  if (today <= 0) return { today, avg, ratio: null, level: 0, text: '오늘 기사 없음' };
  if (avg < 1) {
    return { today, avg, ratio: null, level: today >= 3 ? 2 : 1, text: '평소엔 거의 없던 보도' };
  }
  const ratio = today / avg;
  // 오늘은 하루가 덜 끝났는데 과거는 하루 전체라, 낮을수록 "평소보다 적음"이 잘못 나옴
  // (11/11 검토: 이슈 1위 삼성전자가 오후에 '평소보다 적음'으로 보임) → 눈에 띄게 많을 때만 보여 주고 나머지는 숨김
  if (ratio < 1.5) return null;
  const level = ratio >= 3 ? 3 : 2;
  return { today, avg, ratio, level, text: `평소의 ${ratio.toFixed(1)}배` };
}

export const BUZZ_TIP = '오늘 이 종목 기사 수를 최근 일주일 하루 평균(평일은 평일끼리, 오늘 제외)과 비교했어요. 오늘은 지금까지 나온 기사 기준이에요.';
