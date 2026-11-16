// 홈 '오늘 많이 보도된 소식' 카드판 (11/16 저녁, 뉴스 지도를 대신함)
// 사용자: "지도 말고 색을 매우 연하게, 글씨가 긴 기사 특성상 글씨가 잘 보이게"
// - 지도(트리맵)는 칸 크기가 제목 길이와 맞지 않아 제목이 잘리고, 시장 지도(종목 단위)와 1등이 달라 헷갈렸음
// - 카드 하나 = 소식 하나 (같은 내용 기사 묶음), 많이 보도된 순. 1위만 크게 + 요약 한 줄
// - 색은 바탕을 아주 연하게(좋은 소식 초록·나쁜 소식 주황), 글자는 본문 색 그대로 → 긴 제목도 읽힘. 판단은 글자로도 적음
import { Link } from 'react-router-dom';
import { storyWord } from './NewsMap';
import { toneOfStory } from './Tone';

const TONE_TEXT = { pos: '좋은 소식', neg: '나쁜 소식', mixed: '좋은·나쁜 내용 함께' };

function summarized(story) {
  return [story.lead, ...story.others].find((a) => a.hasSummary) || null;
}

export default function StoryBoard({ stories }) {
  const max = Math.max(1, ...stories.map((s) => s.size || 1));
  return (
    <ol className="story-board">
      {stories.map((st, i) => {
        const a = st.lead;
        const main = (a.relatedStocks || []).find((x) => x.role === 'MAIN') || a.relatedStocks?.[0];
        // '주가 급변' 소식은 좋은·나쁜을 붙이지 않음 (주가 기사에 판단을 붙이면 순환 논리 — 목록 배지와 같은 규칙)
        const tone = storyWord(st) === '주가 급변' ? null : toneOfStory(st);
        const lead = i === 0;
        // 1위 큰 카드는 AI 요약 세 줄을 다 (빈 자리가 남았음)
        const sum = lead ? (summarized(st)?.summary || []).join(' ') : '';
        const count = st.size || 1;
        return (
          <li key={a.id} className={`sb-card sb-${tone?.kind || 'none'} ${lead ? 'sb-lead' : ''}`}>
            <div className="sb-top">
              <span className="sb-rank num">{i + 1}</span>
              {main && <span className="sb-stock">{main.name}</span>}
              {tone && <span className={`sb-tone sb-tone-${tone.kind}`}>{TONE_TEXT[tone.kind]}</span>}
            </div>
            <Link to={`/news/${a.id}`} className="sb-title">
              {a.title}
            </Link>
            {sum && <p className="sb-summary">{sum}</p>}
            <div className="sb-foot num">
              {/* 보도량을 막대로도: 1위 대비 길이 (칸 크기 대신) */}
              <span className="sb-bar" aria-hidden="true">
                <i style={{ width: `${(count / max) * 100}%` }} />
              </span>
              <span>
                같은 소식 기사 <b>{count}</b>건{st.pressCount > 1 ? ` · 언론 ${st.pressCount}곳` : ''}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
