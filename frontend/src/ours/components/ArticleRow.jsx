// 글 한 줄: 제목 → 언론사·시각 → "무슨 일인가" 태그(공시 유형·정정·같은 소식) → 종목 칩
// 감성(긍정·부정)은 목록에 넣지 않음 (상세에서 설명과 함께). 판단 낱말(호재·악재)도 쓰지 않음
// 부품 출처: V7 adapters.toUiArticle + ArticleInfoBadges·sourceLabelOf (main frontend/src/pages/DashboardPageV7.jsx)
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { relativeTime } from '../lib/format';

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
    tags.push(
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
      <span key="c" className="badge badge-warn" title={CORRECTION_TIP}>
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
        주가 움직임 뒤 기사
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

/** 종목 칩: 주인공 먼저, 함께 언급은 "+n". focusCode(지금 보는 종목)는 역할과 상관없이 늘 보여 줌 */
export function StockChips({ stocks, focusCode, max = 3 }) {
  if (!stocks?.length) return null;
  const focus = focusCode ? stocks.find((s) => s.code === focusCode) : null;
  const mains = stocks.filter((s) => s.role === 'MAIN' && s.code !== focusCode);
  const shown = [...(focus ? [focus] : []), ...mains].slice(0, max);
  const rest = stocks.length - shown.length;
  return (
    <>
      {shown.map((s) => (
        <Link
          key={s.code}
          to={`/stocks/${s.code}`}
          className={`chip ${s.code === focusCode ? 'focus' : ''}`}
          aria-label={`${s.name} ${s.roleLabel} 종목 보기`}
        >
          {s.name}
          {(s.code === focusCode || s.role !== 'MAIN') && <span className="role">{s.roleLabel}</span>}
        </Link>
      ))}
      {rest > 0 && <span className="chip-more">외 {rest}종목</span>}
    </>
  );
}

export default function ArticleRow({ article: a, focusCode, compact = false, showSummary = true }) {
  const sns = a.sourceType === 'SNS';
  // 공시는 요약이 제목과 같음 → 요약 줄 생략
  const summary = showSummary && a.hasSummary && !a.isDisclosure ? a.summary.join(' ') : '';
  const tags = ArticleTags({ article: a });
  return (
    <article className="feed-row">
      {sns ? (
        <a className="feed-title" href={a.url} target="_blank" rel="noreferrer">
          {a.title}
          <ExternalLink className="icon-sm" aria-label="새 창에서 원문 열기" style={{ display: 'inline', marginLeft: 4, verticalAlign: -2 }} />
        </a>
      ) : (
        <Link className="feed-title" to={`/news/${a.id}`}>
          {a.title}
        </Link>
      )}
      {summary && !compact && <p className="feed-summary">{summary}</p>}
      <div className="feed-meta">
        <span>{sourceText(a)}</span>
        <time className="dot num" dateTime={a.publishedAtIso || undefined}>
          {relativeTime(a.publishedAtIso)}
        </time>
      </div>
      {(tags.length > 0 || a.relatedStocks.length > 0) && (
        <div className="tags feed-tags">
          {tags}
          <StockChips stocks={a.relatedStocks} focusCode={focusCode} max={compact ? 2 : 3} />
        </div>
      )}
    </article>
  );
}
