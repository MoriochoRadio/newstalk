// 홈 맨 위 '한눈에 보기' 띠 (11/13 페르소나 '준호': 글을 안 읽고 5초 안에 그림으로 안 들어오면 앱을 끄는 사람)
// 첫 화면이 544자 글에 그림 1개였음 → 문장 대신 숫자·색·링 세 칸. 문장은 화면 낭독기용(sr-only)으로 HomePage 에 남김
// ① 오르내림 막대(빨강 오른·파랑 내린, 국내 관례) ② 가장 크게 움직인 종목 ③ 오늘 소식 분위기 링(좋은 초록·나쁜 주황 — 시세 색과 구분)
import { Link } from 'react-router-dom';
import { dirClass, fmtRate } from '../lib/format';
import { ToneRing, countsOf } from './Tone';

export default function MarketGlance({ issues, quotes, articles, priceOff }) {
  const rated = issues.map((i) => ({ i, q: quotes[i.stockCode] })).filter((x) => x.q && x.q.changeRate != null);
  const ready = !priceOff && issues.length > 0 && rated.length === issues.length;
  const up = rated.filter((x) => x.q.changeRate > 0).length;
  const down = rated.filter((x) => x.q.changeRate < 0).length;
  const flat = rated.length - up - down;
  const big = rated.length ? rated.reduce((a, b) => (Math.abs(b.q.changeRate) > Math.abs(a.q.changeRate) ? b : a)) : null;
  // 오늘 기사마다 주인공 종목의 좋은·나쁜 소식 (제목만·요약 전 공시는 판단이 없어 뺌)
  const tone = countsOf(
    (articles || [])
      .filter((a) => !a.titleOnly && !a.disclosurePending)
      .map((a) => (a.relatedStocks.find((s) => s.role === 'MAIN') || a.relatedStocks[0])?.sentiment)
  );
  const toneN = tone.pos + tone.neu + tone.neg;

  return (
    <div className="glance" aria-hidden="true">
      <div className="glance-tile">
        <span className="glance-k">오르내림</span>
        {ready ? (
          <>
            <span className="glance-v num">
              <b className="up">▲{up}</b>
              <span className="glance-sep" />
              <b className="down">▼{down}</b>
            </span>
            <span className="glance-bar">
              <i className="up-bg" style={{ flex: up }} />
              {flat > 0 && <i className="flat-bg" style={{ flex: flat }} />}
              <i className="down-bg" style={{ flex: down }} />
            </span>
          </>
        ) : (
          <span className="skeleton sk-line" style={{ width: '70%' }} />
        )}
      </div>
      <Link className="glance-tile glance-link" to={big ? `/stocks/${big.i.stockCode}` : '/stocks'} tabIndex={-1}>
        <span className="glance-k">가장 크게 움직임</span>
        {ready && big ? (
          <>
            <span className={`glance-v num ${dirClass(big.q.changeRate)}`}>{fmtRate(big.q.changeRate)}</span>
            <span className="glance-name">{big.i.stockName}</span>
          </>
        ) : (
          <span className="skeleton sk-line" style={{ width: '70%' }} />
        )}
      </Link>
      <div className="glance-tile">
        <span className="glance-k">오늘 소식</span>
        {toneN ? (
          <span className="glance-tone">
            <ToneRing pos={tone.pos} neu={tone.neu} neg={tone.neg} size={34} />
            <span className="glance-tone-n num">
              <b className="tb-pos">{tone.pos}</b> 좋은
              <br />
              <b className="tb-neg">{tone.neg}</b> 나쁜
            </span>
          </span>
        ) : (
          <span className="skeleton sk-line" style={{ width: '70%' }} />
        )}
      </div>
    </div>
  );
}
