// "오늘 많이 나온 소식 종류" (11/12, 기사 분위기 온도를 대신함)
// - 사용자 피드백: "뭐가 긍정이라는 거지? 기사를 긍정·부정으로 나누는 게 무슨 소린지 모르겠다" → 판단 없이 '무슨 일이 많았나'만
// - 분류: 브리핑 카드 태그와 같은 낱말 묶음(lib/digest.js TOPICS). AI 판단이 아니라 제목·요약의 낱말 맞추기라 "대략 이런 일이 많았다"는 뜻
// - 세는 단위: 기사 수가 아니라 소식 수 (같은 소식을 여러 언론이 써도 1개 — 받아쓰기·중복이 숫자를 부풀리지 않게)
// - 줄마다 대표 소식 제목 1개(그 종류에서 가장 많은 언론이 다룬 것) → 숫자만이 아니라 실제로 무슨 일인지
import { Link } from 'react-router-dom';
import { TOPICS } from '../lib/digest';

export function topicMix(stories, n = 6) {
  const rows = TOPICS.map((t) => ({ label: t.label, count: 0, stories: [], top: null }));
  for (const st of stories || []) {
    // 대표 기사 하나의 제목·요약만 봄 (묶음 전체 요약을 합치면 한 소식이 여러 종류에 다 걸림 — 11/12 확인)
    const text = `${st.lead.title} ${st.lead.summary.join(' ')}`;
    TOPICS.forEach((t, i) => {
      if (!t.words.some((w) => text.includes(w))) return;
      rows[i].count += 1;
      rows[i].stories.push(st);
    });
  }
  const shown = rows.filter((r) => r.count > 0).sort((x, y) => y.count - x.count).slice(0, n);
  // 줄마다 대표 소식: 많이 다룬 순으로, 위 줄에서 이미 쓴 소식은 건너뜀 (같은 제목이 여러 줄에 반복되지 않게)
  const used = new Set();
  for (const r of shown) {
    const pick = [...r.stories].sort((x, y) => (y.size || 1) - (x.size || 1)).find((st) => !used.has(st.lead.id));
    r.top = pick || null;
    if (pick) used.add(pick.lead.id);
  }
  return shown;
}

export default function TopicMix({ rows, storyCount }) {
  if (!rows.length) return null;
  const max = rows[0].count;
  return (
    <section className="card topic-mix" aria-labelledby="topic-title">
      <div className="card-head">
        <h2 className="card-title" id="topic-title">
          오늘 많이 나온 주제
        </h2>
        <span className="muted num" style={{ fontSize: 'var(--fs-sm)' }}>
          소식 {storyCount}개 기준
        </span>
      </div>
      <ul>
        {rows.map((r) => (
          <li key={r.label}>
            <div className="topic-line">
              <span className="topic-label">{r.label}</span>
              <span className="topic-bar" aria-hidden="true">
                <i style={{ width: `${Math.max(6, (r.count / max) * 100)}%` }} />
              </span>
              <span className="topic-count num">{r.count}개</span>
            </div>
            {r.top && (
              <Link to={`/news/${r.top.lead.id}`} className="topic-example">
                {r.top.lead.title}
              </Link>
            )}
          </li>
        ))}
      </ul>
      <p className="card-note">제목·요약에 나온 낱말로 나눈 거예요. 같은 소식은 언론이 여러 곳이어도 1개로 셌어요.</p>
    </section>
  );
}
