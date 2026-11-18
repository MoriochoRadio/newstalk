// 시장 지도 '한눈에' (11/18 사용자: "시장 지도도 한눈에 버전으로, 정석 FINVIZ 지도처럼 크게, 둥근 것 없이 컨트롤 센터 느낌으로")
// - 코스피·코스닥 시가총액 상위 전부(서버가 주는 최대 60종목)를 업종 상자로 나눠 빈틈없이 (CapMap pro: 칸 사이 1px)
// - 지도 아래 FINVIZ 색 막대(-3% … +3%), 그 아래 '지도 종목 중 오른·내린' 표와 업종별 평균 등락 표
// - 홈 컨트롤 센터와 같은 칸(cc-panel)·글자(11~13px). 새 API 없음: 시장 지도 화면이 이미 받는 값만
import { Link } from 'react-router-dom';
import CapMap, { capHeatStyle } from './CapMap';
import { dirClass, fmtPrice, fmtRate, shortTime } from '../lib/format';
import { marketState } from '../lib/market';

const SCALE = [-3, -2, -1, 0, 1, 2, 3];
const MOVERS_N = 10;

function Panel({ title, right = null, className = '', children }) {
  return (
    <section className={`cc-panel ${className}`}>
      <header className="cc-ph">
        <h2 className="cc-pt">{title}</h2>
        <span className="cc-ph-right">{right}</span>
      </header>
      <div className="cc-pb">{children}</div>
    </section>
  );
}

function MoverTable({ list, empty }) {
  if (!list.length) return <p className="cc-empty">{empty}</p>;
  return list.map((x) => (
    <Link key={x.stockCode} to={`/stocks/${x.stockCode}`} className="cc-row mp-mv">
      <span className="cc-name">{x.stockName}</span>
      <span className="cc-dim mp-sec">{x.sector || ''}</span>
      <span className="num cc-dim">{fmtPrice(x.price)}</span>
      <span className={`num cc-rate ${dirClass(x.changeRate)}`}>{fmtRate(x.changeRate)}</span>
    </Link>
  ));
}

export default function MapPro({ items, news, fetchedAt, height }) {
  const st = marketState();
  const withRate = items.filter((x) => x.changeRate != null);
  const gainers = withRate.filter((x) => x.changeRate > 0).sort((a, b) => b.changeRate - a.changeRate).slice(0, MOVERS_N);
  const losers = withRate.filter((x) => x.changeRate < 0).sort((a, b) => a.changeRate - b.changeRate).slice(0, MOVERS_N);
  // 업종별 평균 등락 (시가총액 가중) — 지도의 업종 띠와 같은 값
  const bySector = new Map();
  items.forEach((x) => {
    const k = x.sector || '기타';
    const s = bySector.get(k) || { name: k, cap: 0, sum: 0, n: 0 };
    s.cap += x.marketCap || 0;
    s.sum += (x.marketCap || 0) * (Number(x.changeRate) || 0);
    s.n += 1;
    bySector.set(k, s);
  });
  const sectors = [...bySector.values()].map((s) => ({ ...s, avg: s.cap ? s.sum / s.cap : 0 })).sort((a, b) => b.avg - a.avg);
  const maxAbs = Math.max(0.5, ...sectors.map((s) => Math.abs(s.avg)));
  const up = withRate.filter((x) => x.changeRate > 0).length;
  const down = withRate.filter((x) => x.changeRate < 0).length;

  return (
    <div className="cc map-cc">
      <Panel
        title={`시가총액 상위 ${items.length}종목 · 업종별`}
        className="mp-map"
        right={
          <span className="cc-dim num">
            <span className="up">▲{up}</span> <span className="down">▼{down}</span> · 크기 시가총액 · 색 등락 · {fetchedAt ? `${shortTime(fetchedAt)} 기준 · ` : ''}
            {st.label}
          </span>
        }
      >
        <CapMap pro items={items} news={news} height={height} limit={items.length} maxShare={0.1} />
        {/* FINVIZ 색 막대: 칸 색이 몇 % 인지 */}
        <div className="cap-map cap-map-pro mp-scale" aria-hidden="true">
          {SCALE.map((r) => {
            const h = capHeatStyle(r);
            return (
              <span key={r} className={`cm-tile ${h.cls} ${h.strong ? 'cm-strong' : ''} ${h.deep ? 'cm-deep' : ''}`} style={h.style}>
                <span className="cm-rate num">{r > 0 ? `+${r}%` : `${r}%`}</span>
              </span>
            );
          })}
        </div>
      </Panel>

      <div className="cc-grid mp-bottom">
        <Panel title="많이 오른" className="mp-g" right={<span className="cc-dim">지도 종목 중</span>}>
          <MoverTable list={gainers} empty="오른 종목이 없어요" />
        </Panel>
        <Panel title="많이 내린" className="mp-l" right={<span className="cc-dim">지도 종목 중</span>}>
          <MoverTable list={losers} empty="내린 종목이 없어요" />
        </Panel>
        <Panel title="업종별 등락" className="mp-s" right={<span className="cc-dim">시가총액 가중 평균</span>}>
          {sectors.map((s) => (
            <div key={s.name} className="cc-row mp-sr">
              <span className="cc-name">{s.name}</span>
              <span className="mp-sbar" aria-hidden="true">
                <i className={s.avg >= 0 ? 'up' : 'down'} style={{ width: `${(Math.abs(s.avg) / maxAbs) * 50}%`, [s.avg >= 0 ? 'left' : 'right']: '50%' }} />
              </span>
              <span className={`num cc-rate ${dirClass(s.avg)}`}>{fmtRate(Math.round(s.avg * 100) / 100)}</span>
              <span className="num cc-dim">{s.n}</span>
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
}
