// 홈 맨 위 "오늘의 핵심 소식" (v3, 2026-11-12): 신문 1면처럼 소식이 주인공, 종목은 소식에 딸린 정보
// - 재료: 오늘 글(loadTodayFeed) → 같은 소식 묶기(groupStories) → 오늘 기사가 많은 순 (11/12: 서버 sameNewsCount 는 어제 기사까지 셈 → 오늘 받은 기사로 셈)
// - 머리기사 1개(크게) + 나머지 3개(오른쪽 단). 카드마다: 제목(명조) · 언론 n곳·첫 보도 · AI 요약 첫 문장(형광펜) · 닿은 종목과 오늘 등락
// - 요약 문장은 묶음 안에서 요약이 있는 기사의 것 (AI 활용 금지 언론사 기사는 요약이 없어서 다른 언론사 요약을 씀)
// - 판단을 붙이지 않음: 등락률은 어제 종가 대비 지금 값일 뿐 (기사 때문이라고 말하지 않음, 화면 맨 아래 안내와 같음)
import { Link } from 'react-router-dom';
import { dirClass, fmtRate, relativeTime } from '../lib/format';
import Tone, { TitleText, ToneRing, storyCounts, toneOfStory, toneRowClass } from './Tone';
import { titleOnlyReason } from '../lib/titleOnly';

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
          <Link key={s.code} to={`/stocks/${s.code}`} className="story-stock">
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
  // 오늘 기사 수 · 언론 수를 따로 (기사 11건 ≠ 언론 11곳, 11/12). 이전 보도까지 묶였으면 전체 수를 덧붙임
  return (
    <p className="story-meta num">
      {size >= 2 ? (
        <>
          <b>
            오늘 기사 {size}건 · 언론 {story.pressCount}곳
          </b>
          {story.total > size ? ` · 이전 보도까지 ${story.total}건` : ''}
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
  const tone = toneOfStory(story);
  return (
    <article className={`story-card ${big ? 'story-big' : ''} ${toneRowClass(tone)}`}>
      <span className="story-rank num">
        <span className="sr-only">오늘 기사가 많은 소식 </span>
        {rank}
        <span className="sr-only">위</span>
      </span>
      <Tone tone={tone} counts={storyCounts(story)} />
      <Link to={`/news/${(s || a).id}`} className="story-headline">
        <TitleText text={a.title} />
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

/** 2위부터 제목만 (11/13 피드백: "1등은 세부 요약이 나와도 좋은데 나머지는 제목들만 깔끔하게")
 *  한 줄: 순위 · 좋은/나쁜 소식 점(링) · 제목 · 주인공 종목과 등락 · 오늘 기사 수 */
function StoryTitles({ stories, quotes, start = 2 }) {
  return (
    <ol className="story-titles" start={start}>
      {stories.map((st, i) => {
        const a = st.lead;
        const s = summarized(st) || a;
        let c = storyCounts(st);
        // 오늘 받은 기사 안에 같은 소식의 판단이 없으면 서버가 센 묶음 판단으로 (11/17)
        if (!c.pos && !c.neg) {
          const g = ((a.relatedStocks || []).find((x) => x.role === 'MAIN') || a.relatedStocks?.[0])?.group;
          if (g && (g.pos || g.neg || g.neu)) c = { pos: g.pos, neg: g.neg, neu: g.neu };
        }
        const main = (a.relatedStocks || []).find((x) => x.role === 'MAIN') || a.relatedStocks?.[0];
        const q = main ? quotes?.[main.code] : null;
        return (
          <li key={a.id}>
            <span className="st-rank num">{start + i}</span>
            <span className="st-main">
              <Link to={`/news/${s.id}`} className="st-title">
                <TitleText text={a.title} />
              </Link>
              <span className="st-meta num">
                {main && (
                  <Link to={`/stocks/${main.code}`} className="st-stock">
                    {main.name}
                    {q && q.changeRate != null && <b className={dirClass(q.changeRate)}> {fmtRate(q.changeRate)}</b>}
                  </Link>
                )}
                {/* 지도 칸의 '기사 n건'(그 종목 오늘 기사 전부)과 구분 (11/16 밤 PM) */}
                {/* 목록·글 화면과 같은 수(서버가 센 같은 소식 기사 수, 어제 보도 포함) — 홈만 오늘 받은 것만 세서 달랐음 (4차 리뷰). 순위는 오늘 기사 수 그대로 */}
                <span>같은 소식 {Math.max(st.total || 0, st.size || 1)}건</span>
                {/* 14px 링(글자 없음)이 로딩 표시처럼 보였음 → 메타 줄 끝에 짧은 글자 (11/16 디자이너 2차 리뷰) */}
                {c.pos > 0 || c.neg > 0 ? (
                  <span className={`st-tone ${c.pos && c.neg ? 'mixed' : c.pos ? 'good' : 'bad'}`}>
                    {/* 11/17 사용자: 11/12 에 좋다고 한 색 섞인 링이 글자로 바뀌어 사라졌음 → 글자 옆에 링 (리뷰 지적 '글자 없는 링'은 글자가 있어 풀림) */}
                    <ToneRing pos={c.pos} neu={c.neu} neg={c.neg} size={16} />
                    {c.pos && c.neg ? '좋은·나쁜 함께' : c.pos ? '좋은 소식' : '나쁜 소식'}
                  </span>
                ) : a.titleOnly && !(st.others || []).some((o) => !o.titleOnly && !o.disclosurePending) ? (
                  // 약관상 AI 를 못 쓰는 언론사 묶음: '판단 없음'(AI 가 읽고 중립)과 구분 (11/17)
                  <span className="st-tone st-tone-none" title={titleOnlyReason(a.press)}>
                    제목만 연결
                    <span className="sr-only"> — {titleOnlyReason(a.press)}</span>
                  </span>
                ) : (
                  <span className="st-tone st-tone-none">
                    <ToneRing neu={1} size={16} />
                    판단 없음
                  </span>
                )}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export default function TopStories({ stories, quotes, titles = false, list = false, moreLink = null }) {
  if (!stories.length) return null;
  const [lead, ...side] = stories;
  // 순위 목록만 (11/13 피드백: "그냥 1~5 순위만, 여백 안 남게") — 1위 큰 카드 옆이 비던 것
  if (list) {
    return (
      <section className="front-page front-dash front-list" aria-labelledby="front-title">
        <div className="section-head front-head">
          <h2 className="section-title" id="front-title">
            가장 많이 다룬 소식
          </h2>
          {moreLink}
        </div>
        <div className="front-titles rank-list">
          <StoryTitles stories={stories} quotes={quotes} start={1} />
        </div>
      </section>
    );
  }
  return (
    <section className={`front-page ${titles ? 'front-dash' : ''}`} aria-labelledby="front-title">
      <div className="section-head front-head">
        <h2 className="section-title" id="front-title">
          가장 많이 다룬 소식
        </h2>
        {moreLink || <p className="section-sub">같은 소식을 쓴 오늘 기사가 많은 순서예요.</p>}
      </div>
      <StoryCard story={lead} rank={1} quotes={quotes} big />
      {titles ? (
        <div className="front-side front-titles">
          <StoryTitles stories={side} quotes={quotes} />
        </div>
      ) : (
        <div className="front-side">
          {side.map((st, i) => (
            <StoryCard key={st.lead.id} story={st} rank={i + 2} quotes={quotes} />
          ))}
        </div>
      )}
    </section>
  );
}

/** 오늘 글 → 많이 다룬 소식 순 (공시 제외). 같은 크기면 최근 것 먼저 */
// 순위·지도에서 뺄 머리말: 게시판·인사·부고·알림 같은 공지성 기사 (11/16 리뷰: '[게시판] … 출시'가 3위). 목록에는 그대로 남음
const NOTICE_HEAD = /^\s*\[(게시판|인사|부고|알림|사고|정정|공지)\]/;

export function rankStories(groupStories, items, n = 4) {
  return groupStories((items || []).filter((a) => !a.isDisclosure && !NOTICE_HEAD.test(a.title || '')))
    // 같은 소식 수가 같으면 AI 가 읽은(요약 있는) 소식 먼저 (11/17 4차 리뷰: 아침엔 1~3위가 모두 '제목만 연결'이라 AI 가 일을 안 한 화면처럼 보였음)
    .sort(
      (x, y) =>
        (y.size || 1) - (x.size || 1) ||
        Number(!y.lead.titleOnly) - Number(!x.lead.titleOnly) ||
        (y.lead.publishedAtIso > x.lead.publishedAtIso ? 1 : -1)
    )
    .slice(0, n);
}
