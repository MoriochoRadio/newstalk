// "오늘 기사 분위기" 온도계 (v3, 11/12 사용자: "공포탐욕지수 같은 것도 쉽다면")
// - 시장 공포탐욕지수는 시장 데이터(변동성·거래량 등)가 필요해서, 대신 우리 데이터로 만들 수 있는 것: 오늘 뉴스의 기사 내용 분위기
// - 점수 = 50 + 50 × (긍정 기사 − 부정 기사) ÷ 판단한 기사 수  → 0(전부 부정) ~ 50(균형) ~ 100(전부 긍정)
// - 재료: 홈이 이미 받은 오늘 글(loadTodayFeed). 공시·판단 보류(제목만 기사 등)는 빼고 셈 → 추가 요청 없음
// - 멘토 원칙: 판단은 투자자. "주가가 오른다/내린다"가 아니라 "오늘 기사 내용이 어느 쪽이 많았나"만 보여 줌
const BANDS = [
  { max: 20, label: '부정 기사가 많아요' },
  { max: 40, label: '부정 쪽이 조금 많아요' },
  { max: 60, label: '비슷해요' },
  { max: 80, label: '긍정 쪽이 조금 많아요' },
  { max: 101, label: '긍정 기사가 많아요' },
];

export function moodOf(items) {
  let pos = 0;
  let neg = 0;
  let neu = 0;
  for (const a of items || []) {
    if (a.isDisclosure || !a.sentiment) continue;
    const s = String(a.sentiment).toUpperCase();
    if (s === 'POSITIVE') pos += 1;
    else if (s === 'NEGATIVE') neg += 1;
    else if (s === 'NEUTRAL') neu += 1;
  }
  const total = pos + neg + neu;
  if (total < 10) return null; // 너무 적으면 숫자가 흔들려서 보여 주지 않음
  const score = Math.round(50 + (50 * (pos - neg)) / total);
  return { score, pos, neg, neu, total, label: BANDS.find((b) => score < b.max).label };
}

export default function MoodGauge({ mood }) {
  if (!mood) return null;
  return (
    <section className="card mood" aria-labelledby="mood-title">
      <div className="card-head">
        <h2 className="card-title" id="mood-title">
          오늘 기사 분위기
        </h2>
        <span className="mood-score num" aria-label={`100점 중 ${mood.score}점`}>
          {mood.score}
        </span>
      </div>
      <p className="mood-label">{mood.label}</p>
      <div className="mood-track" role="img" aria-label={`부정 0에서 긍정 100 사이 ${mood.score}`}>
        <span className="mood-pin" style={{ left: `${mood.score}%` }} />
      </div>
      <div className="mood-scale">
        <span>부정</span>
        <span>균형</span>
        <span>긍정</span>
      </div>
      <p className="mood-counts num">
        뉴스 {mood.total}건 중 긍정 {mood.pos} · 중립 {mood.neu} · 부정 {mood.neg}
      </p>
      <p className="mood-note">기사 내용을 AI가 나눈 것이에요. 주가 예측이 아니에요.</p>
    </section>
  );
}
