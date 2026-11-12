// 홈 맨 위 "오늘의 핵심 소식" (v3, 2026-11-12): 신문 1면처럼 소식이 주인공, 종목은 소식에 딸린 정보
// - 재료: 오늘 글(loadTodayFeed) → 같은 소식 묶기(groupStories) → 많이 다룬 순 (같은 소식 수 = 서버 sameNewsCount)
// - 머리기사 1개(크게) + 나머지 3개(오른쪽 단). 카드마다: 제목(명조) · 언론 n곳·첫 보도 · AI 요약 첫 문장(형광펜) · 닿은 종목과 오늘 등락
// - 요약 문장은 묶음 안에서 요약이 있는 기사의 것 (AI 활용 금지 언론사 기사는 요약이 없어서 다른 언론사 요약을 씀)
// - 판단을 붙이지 않음: 등락률은 어제 종가 대비 지금 값일 뿐 (기사 때문이라고 말하지 않음, 화면 맨 아래 안내와 같음)
import { Link } from 'react-router-dom';
import { dirClass, fmtRate, relativeTime } from '../lib/format';

/** 묶음에서 요약이 있는 기사 (대표 → 나머지 순) */
function summarized(story) {
  return [story.lead, ...story.others].find((a) => a.hasSummary) || null;
}

function StoryStocks({ article, quotes }) {
  const stocks = (article.relatedStocks || []).filter((s) => s.role === 'MAIN').slice(0, 3);
  if (!stocks.length) return null;
  return (
    <div className="story-stocks">
      {stocks.map((s) => {
        const q = quotes?.[s.code];
        return (
          <Link key={s.code} to={`/stocks/${s.code}`} className="story-stock" aria-label={`${s.name} 종목 보기`}>
            <span className="name">{s.name}</span>
            {q && q.changeRate != null && <span className={`num ${dirClass(q.changeRate)}`}>{fmtRate(q.changeRate)}</span>}
          </Link>
        );
      })}
    </div>
  );
}

function StoryMeta({ story }) {
  const a = story.lead;
  const size = story.size || 1;
  return (
    <p className="story-meta num">
      {size >= 2 ? (
        <>
          <b>언론 {size}곳</b>
          {a.firstReportPress ? ` · 첫 보도 ${a.firstReportPress}` : ''}
        </>
      ) : (
        a.press
      )}
      {' · '}
      {relativeTime(a.publishedAtIso)}
    </p>
  );
}

function StoryCard({ story, rank, quotes, big }) {
  const a = story.lead;
  const s = summarized(story);
  const [first, ...rest] = s ? s.summary : [];
  return (
    <article className={`story-card ${big ? 'story-big' : ''}`}>
      <span className="story-rank num" aria-label={`${rank}번째로 많이 다룬 소식`}>
        {rank}
      </span>
      <Link to={`/news/${(s || a).id}`} className="story-headline">
        {a.title}
      </Link>
      <StoryMeta story={story} />
      {first ? (
        <p className="story-summary">
          <span className="mark">{first}</span>
          {big && rest.length > 0 && <> {rest.join(' ')}</>}
        </p>
      ) : (
        <p className="story-summary muted">제목만 확인한 소식이에요. 원문에서 확인해 주세요.</p>
      )}
      <StoryStocks article={a} quotes={quotes} />
      {big && story.others.length > 0 && (
        <div className="story-others">
          <p className="story-others-head">다른 언론은 이렇게 썼어요</p>
          <ul>
            {story.others.slice(0, 3).map((o) => (
              <li key={o.id}>
                <span className="press">{o.press}</span>
                <Link to={`/news/${o.id}`}>{o.title}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

export default function TopStories({ stories, quotes }) {
  if (!stories.length) return null;
  const [lead, ...side] = stories;
  return (
    <section className="front-page" aria-labelledby="front-title">
      <h2 className="sr-only" id="front-title">
        오늘의 핵심 소식
      </h2>
      <StoryCard story={lead} rank={1} quotes={quotes} big />
      <div className="front-side">
        {side.map((st, i) => (
          <StoryCard key={st.lead.id} story={st} rank={i + 2} quotes={quotes} />
        ))}
      </div>
    </section>
  );
}

/** 오늘 글 → 많이 다룬 소식 순 (공시 제외). 같은 크기면 최근 것 먼저 */
export function rankStories(groupStories, items, n = 4) {
  return groupStories((items || []).filter((a) => !a.isDisclosure))
    .sort((x, y) => (y.size || 1) - (x.size || 1) || (y.lead.publishedAtIso > x.lead.publishedAtIso ? 1 : -1))
    .slice(0, n);
}
