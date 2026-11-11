// 이슈 종목 중 많이 오른·내린. 부호를 그대로 씀: 오른 쪽은 +만, 내린 쪽은 -만 (V7 '급하락'에 +5.36% 가 섞이던 문제)
import { Link } from 'react-router-dom';
import { PriceCell, SkeletonRows } from './ui';

function MoverBlock({ label, list, emptyText }) {
  return (
    <div>
      <h3 className="link-label" style={{ marginTop: 0, marginBottom: 4 }}>
        {label}
      </h3>
      {list.length === 0 ? (
        <p className="muted" style={{ fontSize: 'var(--fs-sm)', padding: '6px 8px' }}>
          {emptyText}
        </p>
      ) : (
        list.map((r) => (
          <Link key={r.stockCode} to={`/stocks/${r.stockCode}`} className="mover">
            <span className="mover-name">{r.stockName}</span>
            <PriceCell quote={r.q} stacked={false} />
          </Link>
        ))
      )}
    </div>
  );
}

export default function Movers({ issues, quotes, disabled, loading, title = '이슈 종목 중 등락', top = 3 }) {
  const rows = (issues || [])
    .map((it) => ({ ...it, q: quotes[it.stockCode] }))
    .filter((r) => r.q && r.q.changeRate != null);
  const ups = rows.filter((r) => r.q.changeRate > 0).sort((a, b) => b.q.changeRate - a.q.changeRate).slice(0, top);
  const downs = rows.filter((r) => r.q.changeRate < 0).sort((a, b) => a.q.changeRate - b.q.changeRate).slice(0, top);
  return (
    <section className="card" aria-labelledby="movers-title">
      <div className="card-head" style={{ marginBottom: 8 }}>
        <h2 className="card-title" id="movers-title">
          {title}
        </h2>
      </div>
      {disabled ? (
        <p className="muted">이 서버는 시세 기능이 꺼져 있어요.</p>
      ) : loading && rows.length === 0 ? (
        <SkeletonRows rows={3} compact />
      ) : (
        <div className="stack" style={{ gap: 12 }}>
          <MoverBlock label="많이 오른" list={ups} emptyText="오른 종목이 없어요" />
          <MoverBlock label="많이 내린" list={downs} emptyText="내린 종목이 없어요" />
        </div>
      )}
    </section>
  );
}
