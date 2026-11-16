// 홈 맨 위 '오늘 뉴스 한눈에' (11/13 피드백: "뉴스 중심이니까 뉴스에 대한 시각화를 메인에 크게 딱")
// 뉴스 지도: 오늘의 소식(같은 소식끼리 묶음)을 네모 칸으로. 칸 크기 = 그 소식을 쓴 오늘 기사 수,
//            색 = 그 소식이 주인공 종목에 좋은 소식(초록)·나쁜 소식(주황)·둘 다(반반)·판단 없음(회색). 시세 색(빨강·파랑)과 일부러 다르게
// 옆: 오늘 뉴스 수 · 좋은/나쁜 소식 큰 링 · 오늘 많이 나온 소식 3개
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { squarify } from './MarketMap';
import { ToneRing, countsOf, toneOfStory } from './Tone';
import { TOPICS } from '../lib/digest';

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

/** 칸에 넣을 한두 낱말 (11/13 피드백: 칸마다 기사 제목 전체라 글이 많아 한눈에 안 들어옴)
 *  AI 가 뽑은 핵심 키워드 첫 번째 → 없으면 소식 종류(실적·수주·계약…) → 없으면 비움. 제목 전체는 마우스를 올리면 */
function storyWord(st) {
  const all = [st.lead, ...(st.others || [])];
  const k = all.find((a) => a.keywords?.length)?.keywords[0];
  if (k) return k;
  const text = `${st.lead.title} ${(st.lead.summary || []).join(' ')}`;
  return TOPICS.find((t) => t.words.some((w) => text.includes(w)))?.label || '';
}

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
          const big = w >= 200 && h >= 130;
          const word = storyWord(st);
          // 칸: 종목 이름(크게) + 한두 낱말 + 기사 수. 글자 크기는 칸 크기에 맞춤
          // 이름이 칸 너비를 넘지 않게 (휴대폰 '삼성바이오로…' 잘림): 한글 한 자 ≈ 1em
          const nameLen = Math.max(2, (main?.name || '').length);
          const nameSize = Math.round(Math.max(13, Math.min(30, Math.sqrt(w * h) / 8, (w - 28) / (nameLen * 0.95))));
          // 칸 높이에 들어가는 줄만 (11/16 리뷰: 낮은 칸에서 이름·낱말·기사 수가 겹쳐 잘림). 위아래 여백 20, 낱말 22, 기사 수 26
          const nameH = nameSize * 1.2;
          const showCount = w >= 80 && h >= 20 + nameH + 26;
          const showWord = Boolean(word) && w >= 80 && h >= 20 + nameH + 22 + (showCount ? 26 : 0);
          return (
            <li key={a.id} className="nm-cell" style={{ left: r.x, top: r.y, width: w, height: h }}>
              <Link
                to={`/news/${a.id}`}
                className={`nm-tile nm-${tone?.kind || 'none'} ${big ? 'big' : ''}`}
                aria-label={`${main ? `${main.name}: ` : ''}${a.title}. 오늘 기사 ${st.size || 1}건${tone ? `, ${tone.name}에 ${TONE_WORD[tone.kind]}` : ''}`}
                title={a.title}
              >
                {main && (
                  <span className="nm-name" style={{ fontSize: nameSize }}>
                    {main.name}
                  </span>
                )}
                {showWord && <span className="nm-word">{word}</span>}
                {showCount && (
                  <span className="nm-count num">
                    기사 <b>{st.size || 1}</b>
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
export function NewsPulse({ articles, storyCount, topics = [], disclosureCount = 0 }) {
  const judged = countsOf(
    (articles || [])
      .filter((a) => !a.titleOnly && !a.disclosurePending)
      .map((a) => (a.priceMoveTitle ? 'NEUTRAL' : (a.relatedStocks.find((s) => s.role === 'MAIN') || a.relatedStocks[0])?.sentiment)) // 시세 기사는 판단 없음 (toneOf 와 같게)
  );
  // '판단 없음' = AI가 읽고 좋다·나쁘다 하지 않은 기사 (종목 화면과 같은 뜻). AI가 읽지 않은 기사(제목만·요약 전 공시)는 세지 않고
  // 'AI가 읽은 n건'을 밝혀 세 수의 합과 맞춤 (11/16 PM 2차 리뷰: 홈은 안 읽은 기사까지 '판단 없음'에 넣어 같은 말이 다른 뜻이었음)
  const tone = judged;
  const read = judged.pos + judged.neu + judged.neg;
  return (
    <div className="news-pulse">
      <div className="np-total">
        <span className="np-k">오늘 뉴스</span>
        <span className="np-v num">
          {(articles || []).length.toLocaleString('ko-KR')}
          <small>건</small>
        </span>
        {/* 아래 '뉴스·공시 n건'과 맞춰 보이게 공시 수도 (11/16 리뷰: 173건 vs 182건) */}
        <span className="np-sub num">같은 소식끼리 묶으면 {storyCount}개{disclosureCount ? ` · 공시 ${disclosureCount}건 따로` : ''}</span>
      </div>
      <div className="np-tone">
        <ToneRing pos={tone.pos} neu={tone.neu} neg={tone.neg} size={84} />
        <ul className="np-tone-list num">
          <li>
            <i className="np-dot pos" />
            좋은 소식 <b>{tone.pos}</b>
          </li>
          <li>
            <i className="np-dot neu" />
            판단 없음 <b>{tone.neu}</b>
          </li>
          <li>
            <i className="np-dot neg" />
            나쁜 소식 <b>{tone.neg}</b>
          </li>
          <li className="np-read">AI가 읽은 {read}건</li>
        </ul>
      </div>
      {/* 시간대별 보도량은 뺌 (11/13 피드백: 투자자는 몇 시에 기사가 많았는지 궁금하지 않음) → 오늘 무슨 일이 많았나 */}
      {topics.length > 0 && (
        <div className="np-topics">
          {/* '소식' = 같은 기사를 묶은 것으로만 씀 → 여기는 주제, 숫자는 소식 개수 (11/16 PM 2차 리뷰: '실적 32'가 기사 32건으로 읽힘) */}
          <span className="np-k">오늘 많이 나온 주제</span>
          <ul>
            {topics.slice(0, 3).map((t) => (
              <li key={t.label}>
                <span>{t.label}</span>
                <b className="num">소식 {t.count}개</b>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
