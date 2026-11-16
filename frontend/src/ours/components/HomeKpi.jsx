// 홈 '종목 지도' 시안 맨 위 오늘 숫자 (11/16 저녁 사용자 2차: "칸으로 나눈 게 별로, 새 기사가 올 때마다 최신화되니 멋지고 세련되게")
// - 칸 없이 한 줄: 왼쪽 큰 숫자(오늘 들어온 기사·공시) + 오른쪽 분위기 막대
// - 새 기사가 들어오면 숫자가 굴러 올라가고 '+n' 이 잠깐 떠오름 (움직임 줄이기면 바로 바뀜)
import { useEffect, useRef, useState } from 'react';
import FlipNumber from './FlipNumber';
import { countsOf } from './Tone';
import { shortTime } from '../lib/format';

export default function HomeKpi({ articles, disclosureCount = 0, updatedAt }) {
  const news = articles || [];
  const total = news.length + disclosureCount;
  const t = countsOf(
    news
      .filter((a) => !a.titleOnly && !a.disclosurePending)
      .map((a) => (a.priceMoveTitle ? 'NEUTRAL' : (a.relatedStocks.find((s) => s.role === 'MAIN') || a.relatedStocks[0])?.sentiment))
  );
  const read = t.pos + t.neu + t.neg;
  const pct = (n) => (read ? Math.round((n / read) * 100) : 0);
  // 처음 그린 뒤 늘어난 만큼 '+n' (3초 뒤 사라짐)
  const first = useRef(total);
  const [plus, setPlus] = useState(0);
  const prev = useRef(total);
  useEffect(() => {
    const d = total - prev.current;
    prev.current = total;
    if (d <= 0 || first.current === total) return undefined;
    setPlus(d);
    const id = setTimeout(() => setPlus(0), 3000);
    return () => clearTimeout(id);
  }, [total]);

  return (
    <div className="pulse-line">
      <div className="pl-count">
        <span className="pl-k">오늘 들어온 기사·공시</span>
        <p className="pl-num" aria-live="polite">
          <FlipNumber value={total} />
          <small>건</small>
          {plus > 0 && <em className="pl-plus num">+{plus}</em>}
        </p>
        <span className="pl-sub num">
          뉴스 <b>{news.length.toLocaleString('ko-KR')}</b> · 공시 <b>{disclosureCount.toLocaleString('ko-KR')}</b>
        </span>
      </div>
      <div className="pl-tone">
        <span className="pl-k">오늘 뉴스 분위기</span>
        <div className="pl-bar" role="img" aria-label={`좋은 소식 ${pct(t.pos)}%, 판단 없음 ${pct(t.neu)}%, 나쁜 소식 ${pct(t.neg)}%`}>
          {t.pos > 0 && <i className="pos" style={{ flexGrow: t.pos }} />}
          {t.neu > 0 && <i className="neu" style={{ flexGrow: t.neu }} />}
          {t.neg > 0 && <i className="neg" style={{ flexGrow: t.neg }} />}
        </div>
        <div className="pl-legend num">
          <span className="pos">
            좋은 소식 <b>{pct(t.pos)}%</b>
          </span>
          <span className="neu">판단 없음 {pct(t.neu)}%</span>
          <span className="neg">
            나쁜 소식 <b>{pct(t.neg)}%</b>
          </span>
        </div>
        <span className="pl-note">AI가 읽은 뉴스 {read.toLocaleString('ko-KR')}건 기준 · 주가 예측 아님</span>
        <span className="pl-live">
          <i aria-hidden="true" />
          {updatedAt ? `${shortTime(updatedAt)} 기준 · 새 기사가 오면 숫자가 넘어가요` : '새 기사가 오면 숫자가 넘어가요'}
        </span>
      </div>
    </div>
  );
}
