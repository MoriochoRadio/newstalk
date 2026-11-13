// 홈 맨 위 '오늘 뉴스 한눈에' (11/13 피드백: "뉴스 중심이니까 뉴스에 대한 시각화를 메인에 크게 딱")
// 뉴스 지도: 오늘의 소식(같은 소식끼리 묶음)을 네모 칸으로. 칸 크기 = 그 소식을 쓴 오늘 기사 수,
//            색 = 그 소식이 주인공 종목에 좋은 소식(초록)·나쁜 소식(주황)·둘 다(반반)·판단 없음(회색). 시세 색(빨강·파랑)과 일부러 다르게
// 옆: 오늘 뉴스 수 · 좋은/나쁜 소식 큰 링 · 시간대별 보도량
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { squarify } from './MarketMap';
import { ToneRing, countsOf, toneOfStory } from './Tone';
import HourStrip from './HourStrip';

const GAP = 4;

function useWidth(ref) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    setW(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

const TONE_WORD = { pos: '좋은 소식', neg: '나쁜 소식', mixed: '좋은·나쁜 함께' };

export function NewsMap({ stories, height = 380 }) {
  const boxRef = useRef(null);
  const width = useWidth(boxRef);
  // 기사 수 차이를 크게 (** 1.7): 소식마다 2~4건으로 비슷해 칸이 다 같아 보였음
  // 휴대폰처럼 좁으면 칸 6개만 (12개면 제목이 '펄어비스,겨…'처럼 다 잘림)
  const shown = width && width < 520 ? stories.slice(0, 6) : stories;
  const rects = width && shown.length ? squarify(shown.map((s) => Math.max(1, s.size || 1) ** 1.7), width, height) : [];
  return (
    <div className="news-map" ref={boxRef} style={{ height }}>
      <ul className="nm-tiles" aria-label="오늘의 소식 지도">
        {rects.map((r) => {
          const st = shown[r.i];
          const a = st.lead;
          const tone = toneOfStory(st);
          const w = r.w - GAP;
          const h = r.h - GAP;
          const main = (a.relatedStocks || []).find((x) => x.role === 'MAIN') || a.relatedStocks?.[0];
          const big = w >= 220 && h >= 140;
          const showStock = h >= 56 && w >= 90;
          // 칸 높이에 들어가는 줄 수만 (안쪽 여백 20 + 종목 줄 24, 줄 높이 ≈ 글씨 × 1.4). 넘치면 줄이 반쯤 잘려 보였음
          const lineH = big ? 27 : 24;
          const lines = Math.floor((h - 20 - (showStock ? 26 : 0)) / lineH);
          return (
            <li key={a.id} className="nm-cell" style={{ left: r.x, top: r.y, width: w, height: h }}>
              <Link
                to={`/news/${a.id}`}
                className={`nm-tile nm-${tone?.kind || 'none'}`}
                aria-label={`${a.title}. 오늘 기사 ${st.size || 1}건${tone ? `, ${tone.name}에 ${TONE_WORD[tone.kind]}` : ''}`}
                title={a.title}
              >
                {showStock && main && (
                  <span className="nm-stock">
                    {main.name}
                    <b className="num"> · 기사 {st.size || 1}</b>
                  </span>
                )}
                {w >= 60 && lines >= 1 && (
                  <span className={`nm-title ${big ? 'big' : ''}`} style={{ WebkitLineClamp: lines }}>
                    {a.title}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** 옆 칸: 오늘 뉴스 상태 숫자 */
export function NewsPulse({ articles, storyCount, hours, complete, total }) {
  const tone = countsOf(
    (articles || [])
      .filter((a) => !a.titleOnly && !a.disclosurePending)
      .map((a) => (a.relatedStocks.find((s) => s.role === 'MAIN') || a.relatedStocks[0])?.sentiment)
  );
  return (
    <div className="news-pulse">
      <div className="np-total">
        <span className="np-k">오늘 뉴스</span>
        <span className="np-v num">
          {(articles || []).length.toLocaleString('ko-KR')}
          <small>건</small>
        </span>
        <span className="np-sub num">같은 소식끼리 묶으면 {storyCount}개</span>
      </div>
      <div className="np-tone">
        <ToneRing pos={tone.pos} neu={tone.neu} neg={tone.neg} size={84} />
        <ul className="np-tone-list num">
          <li>
            <i className="np-dot pos" />
            좋은 소식 <b>{tone.pos}</b>
          </li>
          <li>
            <i className="np-dot neg" />
            나쁜 소식 <b>{tone.neg}</b>
          </li>
          <li>
            <i className="np-dot neu" />
            중립 <b>{tone.neu}</b>
          </li>
        </ul>
      </div>
      <div className="np-hours">
        <span className="np-k">시간대별 보도량</span>
        <HourStrip rows={hours} complete={complete} total={total} />
      </div>
    </div>
  );
}
