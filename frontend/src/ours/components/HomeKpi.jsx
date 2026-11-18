// 홈 '종목 지도' 시안 맨 위 오늘 숫자 (11/16 저녁 사용자 6차: "시계 디자인 말고 깔끔한 숫자로 크게, 가운데 빈 여백이 별로,
//  분위기도 막대만 길고 글씨가 작음 → 큼직하고 멋지게")
// - 왼쪽: 큰 숫자(오늘 들어온 기사·공시, 새 기사가 오면 부드럽게 올라감) + 뉴스·공시 비율 막대 → 빈자리 없이 채움
// - 오른쪽: 분위기 세 숫자(좋은 소식·중립·나쁜 소식 %)를 크게, 그 아래 얇은 막대 하나
import { useEffect, useRef, useState } from 'react';
import { countsOf } from './Tone';
import { shortTime } from '../lib/format';

/** 숫자가 이전 값에서 새 값까지 0.9초 동안 부드럽게 (움직임 줄이기면 바로) */
function useCountUp(value) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    from.current = value;
    if (start === value) return undefined;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setShown(value);
      return undefined;
    }
    let raf;
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / 900);
      setShown(Math.round(start + (value - start) * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return shown;
}

export default function HomeKpi({ articles, disclosureCount = 0, updatedAt }) {
  const news = articles || [];
  const total = news.length + disclosureCount;
  const t = countsOf(
    news
      .filter((a) => !a.titleOnly && !a.disclosurePending)
      .map((a) => (a.relatedStocks.find((s) => s.role === 'MAIN') || a.relatedStocks[0])?.sentiment)
  );
  const read = t.pos + t.neu + t.neg;
  const pct = (n) => (read ? Math.round((n / read) * 100) : 0);
  const shown = useCountUp(total);
  // 처음 그린 뒤 늘어난 만큼 '+n' (3초 뒤 사라짐)
  const prev = useRef(total);
  const [plus, setPlus] = useState(0);
  useEffect(() => {
    const d = total - prev.current;
    prev.current = total;
    if (d <= 0) return undefined;
    setPlus(d);
    const id = setTimeout(() => setPlus(0), 3000);
    return () => clearTimeout(id);
  }, [total]);
  const newsShare = total ? (news.length / total) * 100 : 0;

  return (
    <div className="kpi2">
      <section className="kpi2-count" aria-label="오늘 들어온 기사·공시">
        <span className="kpi2-k">오늘 들어온 기사·공시</span>
        <p className="kpi2-num num" aria-live="polite">
          {shown.toLocaleString('ko-KR')}
          <small>건</small>
          {plus > 0 && <em className="kpi2-plus">+{plus}</em>}
        </p>
        <div className="kpi2-split" role="img" aria-label={`뉴스 ${news.length}건, 공시 ${disclosureCount}건`}>
          <i className="news" style={{ width: `${newsShare}%` }} />
          <i className="disc" style={{ width: `${100 - newsShare}%` }} />
        </div>
        <div className="kpi2-split-legend num">
          <span>
            <i className="news" />
            뉴스 <b>{news.length.toLocaleString('ko-KR')}</b>건
          </span>
          <span>
            <i className="disc" />
            공시 <b>{disclosureCount.toLocaleString('ko-KR')}</b>건
          </span>
        </div>
      </section>

      <section className="kpi2-mood" aria-label="오늘 뉴스 분위기">
        <span className="kpi2-k">오늘 뉴스 분위기</span>
        <div className="kpi2-figs num">
          <div className="fig pos">
            <b>
              {pct(t.pos)}
              <small>%</small>
            </b>
            <span>좋은 소식 {t.pos}건</span>
          </div>
          <div className="fig neu">
            <b>
              {pct(t.neu)}
              <small>%</small>
            </b>
            <span>중립 {t.neu}건</span>
          </div>
          <div className="fig neg">
            <b>
              {pct(t.neg)}
              <small>%</small>
            </b>
            <span>나쁜 소식 {t.neg}건</span>
          </div>
        </div>
        <div className="kpi2-bar" aria-hidden="true">
          {t.pos > 0 && <i className="pos" style={{ flexGrow: t.pos }} />}
          {t.neu > 0 && <i className="neu" style={{ flexGrow: t.neu }} />}
          {t.neg > 0 && <i className="neg" style={{ flexGrow: t.neg }} />}
        </div>
        <span className="kpi2-note">
          <i className="kpi2-dot" aria-hidden="true" />
          AI가 읽은 뉴스 {read.toLocaleString('ko-KR')}건 기준 · 주가 예측 아님{updatedAt ? ` · ${shortTime(updatedAt)} 기준, 새 기사가 오면 바로 늘어요` : ''}
        </span>
      </section>
    </div>
  );
}
