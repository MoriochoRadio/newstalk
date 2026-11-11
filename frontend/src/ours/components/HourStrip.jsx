// 오늘 시간대별 보도량 띠 (0시~지금). 칸마다 뉴스·공시를 쌓음. 재료는 오늘 글 전부(todayFeed)의 작성 시각
import { useState } from 'react';

export default function HourStrip({ rows, complete = true, total }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...rows.map((r) => r.news + r.disclosure));
  const peak = rows.reduce((best, r) => (r.news + r.disclosure > (best ? best.news + best.disclosure : 0) ? r : best), null);
  const cur = hover != null ? rows[hover] : null;
  return (
    <div className="hours">
      <div className="hours-readout num">
        {cur ? (
          <>
            <b>{cur.hour}시</b> 뉴스 {cur.news}건 · 공시 {cur.disclosure}건
          </>
        ) : peak ? (
          <>
            가장 많았던 때 <b>{peak.hour}시</b> ({peak.news + peak.disclosure}건)
          </>
        ) : (
          '오늘 기사가 아직 없어요'
        )}
      </div>
      <div
        className="hours-bars"
        role="img"
        aria-label={`오늘 시간대별 기사 수. ${rows.map((r) => `${r.hour}시 ${r.news + r.disclosure}건`).join(', ')}`}
        style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}
      >
        {rows.map((r, i) => {
          const sum = r.news + r.disclosure;
          return (
            <span key={r.hour} className="hours-col" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <span className="hours-stack" style={{ height: `${Math.max(sum ? 6 : 0, (sum / max) * 100)}%` }}>
                {r.news > 0 && <span className="hours-n" style={{ flexGrow: r.news }} />}
                {r.disclosure > 0 && <span className="hours-d" style={{ flexGrow: r.disclosure }} />}
              </span>
            </span>
          );
        })}
      </div>
      <div className="hours-axis num" aria-hidden="true">
        <span>0시</span>
        <span>6시</span>
        <span>12시</span>
        <span>18시</span>
        <span>24시</span>
      </div>
      <div className="hours-legend">
        <span>
          <i className="hours-n" />
          뉴스
        </span>
        <span>
          <i className="hours-d" />
          공시
        </span>
        {!complete && <span className="muted">오늘 {total?.toLocaleString('ko-KR')}건 중 받은 범위 기준</span>}
      </div>
    </div>
  );
}
