// 글 한 줄: 제목 → 언론사·시각 → "무슨 일인가" 태그(공시 유형·정정·같은 소식) → 종목 칩
// 감성: 11/12 저녁부터 제목 위에 "○○에 좋은/나쁜 소식" 한 줄 (components/Tone.jsx, 회사 이름을 붙여 무엇에 대한 판단인지 분명히). 판단 낱말(호재·악재)은 쓰지 않음
// 부품 출처: V7 adapters.toUiArticle + ArticleInfoBadges·sourceLabelOf (main frontend/src/pages/DashboardPageV7.jsx)
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ExternalLink, FileText, MessageCircle, Newspaper } from 'lucide-react';
import { groupStories } from '../lib/stories';
import { titleOnlyReason } from '../lib/titleOnly';
import { relativeTime } from '../lib/format';
import { explainDisclosure } from '../lib/disclosureGlossary';
import Tone, { Highlight, TONE_TIP, TitleText, ToneRing, storyCounts, toneOf, toneOfStory, toneRowClass } from './Tone';

export const SAME_NEWS_TIP = '같은 종목·24시간 안·제목이 비슷한 기사를 같은 소식으로 묶은 수예요. 묶음은 틀릴 수 있어요.';
const CORRECTION_TIP = '앞서 낸 공시를 고쳐 다시 낸 공시예요.';
const PRICE_MOVE_TIP = '주가가 움직인 뒤에 쓴 기사예요. 이미 값에 반영됐을 수 있어요.';

/** 출처 이름: 공시면 "공시 · 잠정실적", SNS 면 "SNS", 뉴스면 언론사 */
export function sourceText(a) {
  if (a.sourceType === 'SNS') return a.press ? `SNS · ${a.press}` : 'SNS';
  if (a.isDisclosure) return '전자공시';
  return a.press || '뉴스';
}

/** 무슨 일인가 태그 (사실만) */
export function ArticleTags({ article: a, detail = false }) {
  const tags = [];
  if (a.isDisclosure) {
    // 목록에서는 제목 위 "공시 · 유형" 글자로 보여 주므로 상세에서만 배지 (11/12: 왼쪽 파란 띠가 뭔지 모르겠다는 피드백)
    if (detail) tags.push(
      <span key="d" className="badge badge-accent">
        공시{a.disclosureType ? ` · ${a.disclosureType}` : ''}
      </span>
    );
    if (a.disclosureKindLabel && a.disclosureKind !== 'MANDATORY') {
      tags.push(
        <span key="k" className="badge">
          {a.disclosureKindLabel === '자율' ? '자율공시' : a.disclosureKindLabel}
        </span>
      );
    }
  }
  if (a.disclosureCorrection) {
    tags.push(
      <span key="c" className="badge" title={CORRECTION_TIP}>
        정정 공시
      </span>
    );
  }
  if (a.sameNewsCount >= 2) {
    tags.push(
      <span key="s" className="badge" title={SAME_NEWS_TIP}>
        {a.firstReport ? `첫 보도 · 같은 소식 ${a.sameNewsCount}건` : `같은 소식 ${a.sameNewsCount}건`}
      </span>
    );
  }
  if (a.priceMoveTitle) {
    tags.push(
      <span key="p" className="badge badge-outline" title={PRICE_MOVE_TIP}>
        주가 기사
      </span>
    );
  }
  if (a.sourceType === 'SNS') {
    tags.push(
      <span key="sns" className="badge badge-warn">
        참고용 · 확인되지 않은 정보
      </span>
    );
  }
  if (detail && a.contextDependent) {
    tags.push(
      <span key="ctx" className="badge badge-outline">
        목적·방식에 따라 해석이 달라지는 공시
      </span>
    );
  }
  return tags;
}

/**
 * 종목 칩 + 역할 배지 (V7 장점: 주인공·함께 언급). 주인공은 진한 배지, 함께 언급은 회색 배지, 간접 연결은 점선 테두리 + "AI 추정"
 * 주인공을 먼저, 남는 자리에 함께 언급. 넘치면 "함께 언급 외 n" (이름은 마우스를 올리면). focusCode(지금 보는 종목)는 늘 맨 앞
 */
export function StockChips({ stocks, focusCode, max = 3 }) {
  if (!stocks?.length) return null;
  const focus = focusCode ? stocks.find((s) => s.code === focusCode) : null;
  const rest0 = stocks.filter((s) => s.code !== focusCode);
  const ordered = [...(focus ? [focus] : []), ...rest0.filter((s) => s.role === 'MAIN'), ...rest0.filter((s) => s.role !== 'MAIN')];
  const shown = ordered.slice(0, max);
  const hidden = ordered.slice(max);
  return (
    <>
      {shown.map((s) => {
        const indirect = s.matchType === 'INDIRECT';
        return (
          <Link
            key={s.code}
            to={`/stocks/${s.code}`}
            className={`chip ${s.code === focusCode ? 'focus' : ''} ${s.role === 'MAIN' ? 'chip-main' : 'chip-mentioned'} ${indirect ? 'chip-indirect' : ''}`}
            aria-label={`${s.name} ${indirect ? 'AI 추정' : s.roleLabel} 종목 보기`}
          >
            {s.name}
            <span className="role">{indirect ? 'AI 추정' : s.roleLabel}</span>
          </Link>
        );
      })}
      {hidden.length > 0 && (
        <span className="chip-more" title={hidden.map((s) => s.name).join(', ')}>
          외 {hidden.length}종목
          <span className="sr-only">: {hidden.map((s) => s.name).join(', ')}</span>
        </span>
      )}
    </>
  );
}

/**
 * 글 한 줄. others 가 있으면(같은 소식 묶음) "같은 소식 다른 기사 n건" 을 눌러 펼침 — 목록은 소식 단위로 짧게
 */
/** 줄 왼쪽 큰 그림 칸 (11/16 사용자: '나쁜 소식' 표시가 제목 위에 작아 와닿지 않음)
 *  그림 = 늘 글 종류(신문·공시 문서·SNS 말풍선), 칸 색 = AI 판단(좋은 소식 초록·나쁜 소식 주황)
 *  엄지 위·아래는 증권 앱에서 '추천·매수'로 읽혀서, 화살표는 주가 등락으로 읽혀서 쓰지 않음 (11/16 PM 리뷰) */
function KindIcon({ tone, article: a }) {
  const Icon = a.isDisclosure ? FileText : a.sourceType === 'SNS' ? MessageCircle : Newspaper;
  const kind = tone ? (tone.kind === 'pos' ? 'good' : tone.kind === 'neg' ? 'bad' : 'mixed') : a.isDisclosure ? 'disc' : 'news';
  return (
    <span className={`feed-icon fi-${kind}`} aria-hidden="true">
      <Icon />
    </span>
  );
}

/** 링이 없는 줄의 회색 표시 종류: 'titleOnly' | 'neutral' | null */
function quietOf(a, focusCode, toneCodes) {
  if (a.titleOnly) return 'titleOnly';
  if (a.disclosurePending) return null;
  const stocks = a.relatedStocks || [];
  const pool = toneCodes ? stocks.filter((x) => toneCodes.has(x.code)) : stocks;
  const s = (focusCode && pool.find((x) => x.code === focusCode)) || pool.find((x) => x.role === 'MAIN') || pool[0];
  if (!s || s.role !== 'MAIN') return null;
  return s.sentiment === 'POSITIVE' || s.sentiment === 'NEGATIVE' ? null : 'neutral';
}

export default function ArticleRow({ article: a, others = [], focusCode, toneCodes, compact = false, showSummary = true }) {
  const [open, setOpen] = useState(false);
  const sns = a.sourceType === 'SNS';
  // 공시도 원문을 AI 가 요약함 (11/13 지난 공시까지 채움). 요약 전 공시는 어댑터가 hasSummary=false 로 줌 → 요약 줄 생략
  const summary = showSummary && a.hasSummary ? a.summary.join(' ') : '';
  // 펼침 단추('같은 소식 다른 기사 n건')가 있으면 '같은 소식 n건' 칩은 뺌 — 2건·1건이 다른 숫자처럼 보였음 (11/16 리뷰 9번)
  const tags = ArticleTags({ article: a }).filter((t) => !(others.length > 0 && t.key === 's'));
  // 대표 기사 판단이 없으면(제목만 받은 언론사 등) 같은 소식의 다른 기사가 받은 AI 판단으로 링 (11/17 사용자: 목록은 '제목만 연결'인데
  // 들어가 보면 '나쁜 소식으로 봤어요'라 어긋났음). 관심 종목 화면처럼 종목을 거르는 곳(toneCodes·focusCode)은 대표 기사 기준 그대로
  const own = toneOf(a, focusCode, toneCodes);
  const storyTone = !own && others.length && !focusCode && !toneCodes ? toneOfStory({ lead: a, others }) : null;
  const tone = own || storyTone;
  const toneCounts = storyTone ? storyCounts({ lead: a, others }) : undefined;
  // 링 없는 줄도 같은 자리에 표시 (11/17 사용자: 어떤 줄은 링이 있고 어떤 줄은 없어 왜 없는지 모름 → 회색 링 + 글자)
  //  - AI 가 읽고 좋다·나쁘다 하지 않은 기사: 회색 링 + '판단 없음'
  //  - 약관상 AI 요약을 못 하는 언론사(제목만 받은 기사): 회색 '요약 없음'
  //  주가 기사는 '주가 기사' 꼬리표가 따로 있고, 주인공 종목이 없는 기사(함께 언급만)는 판단 대상이 아니라 그대로 둠
  // 대표가 제목만 받은 기사여도 같은 소식에 AI 가 읽은 기사가 있으면 '판단 없음'(회색 링) — '제목만 연결'은 같은 소식 전부가 제목만일 때
  const aiSibling = !focusCode && !toneCodes && others.some((o) => !o.titleOnly && !o.disclosurePending);
  const quiet = tone || sns ? null : a.titleOnly && aiSibling ? 'neutral' : quietOf(a, focusCode, toneCodes);
  const latestIso = [a, ...others].map((x) => x.publishedAtIso).filter(Boolean).sort().pop() || a.publishedAtIso;
  return (
    <article className={`feed-row feed-row-v2 ${a.isDisclosure ? 'is-disclosure' : ''} ${toneRowClass(tone)}`}>
      <KindIcon tone={tone} article={a} />
      <div className="feed-body">
      {sns ? (
        <a className="feed-title" href={a.url} target="_blank" rel="noreferrer">
          <TitleText text={a.title} />
          <ExternalLink className="icon-sm" aria-hidden="true" style={{ display: 'inline', marginLeft: 4, verticalAlign: -2 }} />
          <span className="sr-only">(새 창에서 원문 열기)</span>
        </a>
      ) : (
        <Link className="feed-title" to={`/news/${a.id}`}>
          <TitleText text={a.title} />
        </Link>
      )}
      {(a.isDisclosure || tone || quiet) && (
        <div className="feed-kicker-line feed-context">
          {a.isDisclosure && (
            <span className="feed-kicker" title={explainDisclosure(a.disclosureType) || undefined}>
              공시{a.disclosureType ? ` · ${a.disclosureType}` : ''}
            </span>
          )}
          <Tone tone={tone} withName={!focusCode} counts={toneCounts} />
          {quiet === 'neutral' && (
            <span className="tone tone-quiet" title={TONE_TIP}>
              <ToneRing neu={1} size={16} />
              <span>판단 없음</span>
            </span>
          )}
          {quiet === 'titleOnly' && (
            // '요약 없음'은 기능이 안 되는 것처럼 보였고(11/17 사용자), 긴 '약관상 AI 판단 안 함'은 줄마다 반복돼 소음 + 본문 실패 기사엔 사실과 달랐음
            // (4차 리뷰) → 한 것만 짧게 '제목만 연결', 이유(약관/본문 실패)는 설명과 화면 낭독기로. 목록 위에 한 번 안내 (NewsPage)
            <span className="tone tone-quiet tone-titleonly" title={titleOnlyReason(a.press)}>
              제목만 연결
              <span className="sr-only"> — {titleOnlyReason(a.press)}</span>
            </span>
          )}
        </div>
      )}
      {summary && !compact && (
        <p className="feed-summary">
          <Highlight text={summary} />
        </p>
      )}
      {/* 종목 칩과 언론·시각을 한 줄로 (11/13: 글마다 세 줄이라 스크롤이 길었음). 좁으면 자연히 두 줄 */}
      <div className="feed-foot">
        {(tags.length > 0 || a.relatedStocks.length > 0) && (
          <div className="tags feed-tags">
            <StockChips stocks={a.relatedStocks} focusCode={focusCode} max={compact ? 2 : 3} />
            {tags}
          </div>
        )}
        <div className="feed-meta">
          <span>{sourceText(a)}</span>
          {/* 같은 소식 묶음은 대표가 첫 보도(더 오래됨)라 목록이 '2시간 전 → 4시간 전 → 2시간 전'으로 섞여 보였음
              → 줄 자리(최신순)와 맞게 묶음의 가장 최근 시각 (11/16 3차 리뷰) */}
          <time className="dot num" dateTime={latestIso || undefined}>
            {/* 언론사는 대표(첫 보도) 것이라, 시각이 다른 기사 것이면 '최근' 을 붙여 같은 기사 시각으로 읽히지 않게 (4차 리뷰) */}
            {latestIso !== a.publishedAtIso ? `최근 ${relativeTime(latestIso)}` : relativeTime(latestIso)}
          </time>
        </div>
      </div>
      {others.length > 0 && (
        <div className="story-more">
          <button type="button" className="story-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            같은 소식 기사 {others.length + 1}건 모두 보기
            <ChevronDown className="icon-sm chev" aria-hidden="true" />
          </button>
          {open && (
            <ul className="story-list">
              {others.map((o) => (
                <li key={o.id}>
                  <Link to={`/news/${o.id}`}>{o.title}</Link>
                  <span className="muted num">
                    {o.press} · {relativeTime(o.publishedAtIso)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      </div>
    </article>
  );
}

/** 글 목록을 소식 단위로 (같은 소식은 첫 보도 한 줄 + 펼치기) */
export function StoryFeed({ articles, focusCode, toneCodes, compact = false, className = 'feed', style }) {
  const stories = groupStories(articles);
  return (
    <div className={className} style={style}>
      {stories.map((st) => (
        <ArticleRow key={st.lead.id} article={st.lead} others={st.others} focusCode={focusCode} toneCodes={toneCodes} compact={compact} />
      ))}
    </div>
  );
}
