// 종목 브리핑 카드: "오늘 이 종목에 무슨 일" 을 기사를 열지 않고 알게
// 종목명·현재가·등락률·추세선 → AI 종합 요약 2~3줄(없으면 주인공 기사 제목, 그렇다고 밝힘) → 소식 종류 태그 → 기사·언론사 수·평소 대비 보도량·첫 기사 시각
// 말은 조심스럽게: 호재·악재·예측·"때문에" 를 쓰지 않음. 등락률은 어제 종가 대비 값일 뿐
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { dirClass, fmtPrice, fmtRate, shortTime } from '../lib/format';
import { BUZZ_TIP } from '../lib/buzz';
import Sparkline from './Sparkline';
import { TONE_TIP, ToneRing, leanOf, toneCountText } from './Tone';

/** 오늘 이 종목 기사들의 좋은·나쁜 소식 비율 (서버가 센 값, 링 = 시그니처) */
function BriefTone({ sentiment: t }) {
  if (!t || !t.articleCount || (!t.positiveCount && !t.negativeCount)) return null;
  const lean = leanOf(t.positiveCount, t.neutralCount || 0, t.negativeCount);
  return (
    // 숫자 설명("AI가 읽은 기사 2건: 좋은 0 · 나쁜 1 …")은 마우스를 올리면 (11/16 글 줄이기: 링과 한 마디로 충분)
    <p className={`brief-tone brief-tone-${lean.kind}`} title={`${toneCountText(t.positiveCount, t.neutralCount || 0, t.negativeCount)}. ${TONE_TIP}`}>
      <ToneRing pos={t.positiveCount} neu={t.neutralCount} neg={t.negativeCount} size={22} />
      <b>{lean.text}</b>
    </p>
  );
}

export default function BriefCard({ rank, code, name, quote, quoteLoading, priceOff, summary, digest, buzz, firstAt, articleCount, compact = false }) {
  const cls = dirClass(quote?.changeRate);
  const text = summary?.newsSummary || '';
  const tags = [
    ...(digest?.disclosureTypes || []).map((t) => ({ key: `d-${t}`, label: `공시 · ${t}`, kind: 'accent' })),
    ...(digest?.topics || []).map((t) => ({ key: `t-${t.label}`, label: `${t.label} ${t.count}`, kind: '' })),
  ].slice(0, compact ? 2 : 4);
  const count = articleCount ?? digest?.newsCount ?? 0;

  return (
    <article className={`brief ${compact ? 'brief-compact' : ''}`}>
      <Link to={`/stocks/${code}`} className="brief-head">
        {rank != null && <span className="brief-rank num">{rank}</span>}
        <span className="brief-name">{name}</span>
        <span className="brief-price num">
          {quote ? (
            <>
              <b>{fmtPrice(quote.price)}</b>
              <span className={`brief-rate ${cls}`}>{fmtRate(quote.changeRate)}</span>
            </>
          ) : quoteLoading && !priceOff ? (
            <span className="skeleton" style={{ display: 'inline-block', width: 96, height: 18 }} />
          ) : null}
        </span>
      </Link>
      {!compact && (
        <div className="brief-spark">
          <Sparkline code={code} name={name} disabled={priceOff} />
          {!priceOff && <span className="muted">20일</span>}
        </div>
      )}

      <div className="brief-body">
        {summary === undefined ? (
          <>
            <div className="skeleton sk-line" style={{ width: '96%' }} />
            <div className="skeleton sk-line" style={{ width: '88%' }} />
          </>
        ) : text ? (
          <p className="brief-summary">
            <Sparkles className="icon-sm brief-ai" aria-hidden="true" />
            <span className="sr-only">AI 요약: </span>
            {text}
          </p>
        ) : digest?.headlines?.length ? (
          <>
            <ul className="brief-heads">
              {digest.headlines.slice(0, compact ? 1 : 2).map((h) => (
                <li key={h.id}>
                  <Link to={`/news/${h.id}`}>{h.title}</Link>
                </li>
              ))}
            </ul>
            <p className="brief-note">AI 요약이 아직 없어 주요 기사 제목을 보여 드려요.</p>
          </>
        ) : (
          // 기사 수가 있는데 '기사가 없어요'라 하면 모순 (11/13: 요약·기사 목록을 못 받았을 때 '기사 7건' 옆에 이렇게 나옴)
          <p className="brief-note">{articleCount ? '아직 AI 요약이 없어요.' : '오늘 요약할 기사가 아직 없어요.'}</p>
        )}
      </div>

      <BriefTone sentiment={summary?.sentiment} />

      {tags.length > 0 && (
        <div className="tags brief-tags">
          {tags.map((t) => (
            <span key={t.key} className={`badge ${t.kind ? `badge-${t.kind}` : ''}`}>
              {t.label}
            </span>
          ))}
        </div>
      )}

      <div className="brief-foot num">
        <span>
          기사 <b>{count}</b>건{digest?.pressCount ? ` · 언론 ${digest.pressCount}곳` : ''}
          {digest?.disclosureCount ? ` · 공시 ${digest.disclosureCount}건` : ''}
        </span>
        {buzz && (
          <span className={`buzz buzz-${buzz.level}`} title={BUZZ_TIP}>
            {buzz.text}
          </span>
        )}
        {firstAt && <span className="muted">첫 기사 {shortTime(firstAt)}</span>}
      </div>
    </article>
  );
}
