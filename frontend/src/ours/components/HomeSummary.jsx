// 홈 맨 위 '한눈에 요약' 띠 (11/16 저녁 사용자: "시각화 자료로 먼저 간단 요약처럼 떠먹여 주고, 그 밑에 자세한 요약")
// 대시보드 정석(개요 먼저 → 자세히는 아래)과 뉴스 역피라미드: 숫자 네 칸을 먼저, 소식 목록은 그 아래
//  ① 오늘 기사 수  ② 좋은·나쁜 소식 비율(막대 하나)  ③ 많이 나온 주제  ④ 기사 많은 종목
import { Link } from 'react-router-dom';
import { countsOf } from './Tone';

export default function HomeSummary({ articles, storyCount, disclosureCount = 0, topics = [], issues = [] }) {
  // 좋은·나쁜 판단: AI가 읽은 기사만 (제목만 받은 기사·요약 전 공시는 빼고), 시세 기사는 판단 없음 — 목록 배지와 같은 규칙
  const t = countsOf(
    (articles || [])
      .filter((a) => !a.titleOnly && !a.disclosurePending)
      .map((a) => (a.relatedStocks.find((s) => s.role === 'MAIN') || a.relatedStocks[0])?.sentiment)
  );
  const read = t.pos + t.neu + t.neg;
  const pct = (n) => (read ? Math.round((n / read) * 100) : 0);
  const topicMax = Math.max(1, ...topics.slice(0, 3).map((x) => x.count));
  const stockMax = Math.max(1, ...issues.slice(0, 3).map((x) => x.articleCount || 0));
  return (
    <div className="home-summary">
      <section className="hs-tile">
        <h3 className="hs-k">오늘 기사</h3>
        <p className="hs-big num">
          {(articles || []).length.toLocaleString('ko-KR')}
          <small>건</small>
        </p>
        <p className="hs-sub num">
          같은 소식 묶으면 {storyCount}개{disclosureCount ? ` · 공시 ${disclosureCount}건 따로` : ''}
        </p>
      </section>

      <section className="hs-tile">
        <h3 className="hs-k">좋은·나쁜 소식</h3>
        {read ? (
          <>
            <div className="hs-tone-bar" role="img" aria-label={`좋은 소식 ${t.pos}건, 판단 없음 ${t.neu}건, 나쁜 소식 ${t.neg}건`}>
              {t.pos > 0 && <i className="pos" style={{ flexGrow: t.pos }} />}
              {t.neu > 0 && <i className="neu" style={{ flexGrow: t.neu }} />}
              {t.neg > 0 && <i className="neg" style={{ flexGrow: t.neg }} />}
            </div>
            <ul className="hs-tone-list num">
              <li className="pos">
                좋은 <b>{t.pos}</b>건 <span>{pct(t.pos)}%</span>
              </li>
              <li className="neu">
                판단 없음 <b>{t.neu}</b>건
              </li>
              <li className="neg">
                나쁜 <b>{t.neg}</b>건 <span>{pct(t.neg)}%</span>
              </li>
            </ul>
            <p className="hs-sub">AI가 읽은 기사 {read}건 기준 · 주가 예측 아님</p>
          </>
        ) : (
          <p className="hs-sub">아직 AI가 읽은 기사가 없어요</p>
        )}
      </section>

      <section className="hs-tile">
        <h3 className="hs-k">많이 나온 주제</h3>
        <ul className="hs-bars">
          {topics.slice(0, 3).map((x) => (
            <li key={x.label}>
              <span className="hs-bl">{x.label}</span>
              <span className="hs-bar" aria-hidden="true">
                <i style={{ width: `${(x.count / topicMax) * 100}%` }} />
              </span>
              <b className="num">소식 {x.count}개</b>
            </li>
          ))}
        </ul>
      </section>

      <section className="hs-tile">
        <h3 className="hs-k">기사 많은 종목</h3>
        <ul className="hs-bars">
          {issues.slice(0, 3).map((x) => (
            <li key={x.stockCode}>
              <Link to={`/stocks/${x.stockCode}`} className="hs-bl">
                {x.stockName}
              </Link>
              <span className="hs-bar" aria-hidden="true">
                <i style={{ width: `${((x.articleCount || 0) / stockMax) * 100}%` }} />
              </span>
              <b className="num">기사 {x.articleCount}건</b>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
