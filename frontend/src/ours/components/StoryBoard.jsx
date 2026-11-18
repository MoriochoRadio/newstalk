// 홈 '오늘 많이 보도된 소식' 순위 목록 (11/16 저녁, 뉴스 지도 → 카드판 → 큼직한 목록)
// 사용자: "모아서 두는 것보다 아까(뉴스 목록)처럼 리스트로, 큼직하고 글도 잘 보이게"
// - 줄 하나 = 소식 하나 (같은 내용 기사 묶음), 많이 보도된 순
// - 왼쪽 큰 순위 숫자, 위 꼬리줄(종목·판단), 제목 20px, AI 요약 두 줄, 아래 보도량 막대 + '같은 소식 기사 n건 · 언론 n곳'
// - 판단은 아주 연한 바탕색 + 왼쪽 띠 + 글자 (색만으로 구분하지 않음)
import { Link } from 'react-router-dom';
import { storyWord } from './NewsMap';
import { toneOfStory } from './Tone';
import { relativeTime } from '../lib/format';

const TONE_TEXT = { pos: '좋은 소식', neg: '나쁜 소식', mixed: '좋은·나쁜 내용 함께' };

function summarized(story) {
  return [story.lead, ...story.others].find((a) => a.hasSummary) || null;
}

export default function StoryBoard({ stories }) {
  const max = Math.max(1, ...stories.map((s) => s.size || 1));
  return (
    <ol className="home-rank">
      {stories.map((st, i) => {
        const a = st.lead;
        const main = (a.relatedStocks || []).find((x) => x.role === 'MAIN') || a.relatedStocks?.[0];
        // '주가 급변' 소식은 좋은·나쁜을 붙이지 않음 (주가 기사에 판단을 붙이면 순환 논리 — 목록 배지와 같은 규칙)
        const tone = storyWord(st) === '주가 급변' ? null : toneOfStory(st);
        const sum = (summarized(st)?.summary || []).join(' ');
        const count = st.size || 1;
        const latest = [a, ...st.others].map((x) => x.publishedAtIso).filter(Boolean).sort().pop();
        return (
          <li key={a.id} className={`sr-row sr-${tone?.kind || 'none'}`}>
            <span className="sr-rank num">{i + 1}</span>
            <div className="sr-body">
              <div className="sr-top">
                {main && (
                  <Link to={`/stocks/${main.code}`} className="sr-stock">
                    {main.name}
                  </Link>
                )}
                {tone && <span className={`sr-tone sr-tone-${tone.kind}`}>{TONE_TEXT[tone.kind]}</span>}
              </div>
              <Link to={`/news/${a.id}`} className="sr-title">
                {a.title}
              </Link>
              {sum && <p className="sr-summary">{sum}</p>}
              <div className="sr-foot num">
                {/* 보도량: 1위 대비 막대 */}
                <span className="sr-bar" aria-hidden="true">
                  <i style={{ width: `${(count / max) * 100}%` }} />
                </span>
                <span>
                  같은 소식 기사 <b>{count}</b>건{st.pressCount > 1 ? ` · 언론 ${st.pressCount}곳` : ''}
                  {latest ? ` · 최근 ${relativeTime(latest)}` : ''}
                </span>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
