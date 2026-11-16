// 홈 '종목 지도' 시안 위 숫자 띠 (11/16 저녁 사용자: "오늘 기사 275건 · 같은 소식 묶으면 …" 배치를 다르게, '소식'이 무슨 말인지 모름)
// 증권 앱 지수 띠처럼 한 줄: 오늘 기사 | 뉴스 | 공시 | 좋은·나쁜 소식 막대
// '같은 소식 묶으면 n개'는 처음 보는 사람이 '소식'의 뜻을 몰라 뺌 — 묶음 수는 아래 목록이 이미 보여 줌
import { countsOf } from './Tone';

export default function HomeKpi({ articles, disclosureCount = 0 }) {
  const news = articles || [];
  const t = countsOf(
    news
      .filter((a) => !a.titleOnly && !a.disclosurePending)
      .map((a) => (a.priceMoveTitle ? 'NEUTRAL' : (a.relatedStocks.find((s) => s.role === 'MAIN') || a.relatedStocks[0])?.sentiment))
  );
  const read = t.pos + t.neu + t.neg;
  const pct = (n) => (read ? Math.round((n / read) * 100) : 0);
  return (
    <div className="kpi-strip">
      <div className="kpi kpi-main">
        <span className="kpi-k">오늘 기사·공시</span>
        <b className="kpi-v num">
          {(news.length + disclosureCount).toLocaleString('ko-KR')}
          <small>건</small>
        </b>
      </div>
      <div className="kpi">
        <span className="kpi-k">뉴스</span>
        <b className="kpi-v num">
          {news.length.toLocaleString('ko-KR')}
          <small>건</small>
        </b>
      </div>
      <div className="kpi">
        <span className="kpi-k">공시</span>
        <b className="kpi-v num">
          {disclosureCount.toLocaleString('ko-KR')}
          <small>건</small>
        </b>
      </div>
      <div className="kpi kpi-tone">
        <span className="kpi-k">AI가 읽은 뉴스 {read}건의 분위기</span>
        <div className="hs-tone-bar" role="img" aria-label={`좋은 소식 ${t.pos}건, 판단 없음 ${t.neu}건, 나쁜 소식 ${t.neg}건`}>
          {t.pos > 0 && <i className="pos" style={{ flexGrow: t.pos }} />}
          {t.neu > 0 && <i className="neu" style={{ flexGrow: t.neu }} />}
          {t.neg > 0 && <i className="neg" style={{ flexGrow: t.neg }} />}
        </div>
        <span className="kpi-tone-row num">
          <span className="pos">
            좋은 소식 <b>{t.pos}</b>건 {pct(t.pos)}%
          </span>
          <span className="neg">
            나쁜 소식 <b>{t.neg}</b>건 {pct(t.neg)}%
          </span>
        </span>
      </div>
    </div>
  );
}
