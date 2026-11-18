// 종목 브리핑 카드: "오늘 이 종목에 무슨 일" 을 기사를 열지 않고 알게
// 종목명·현재가·등락률·추세선 → AI 종합 요약 2~3줄(없으면 주인공 기사 제목, 그렇다고 밝힘) → 소식 종류 태그 → 기사·언론사 수·평소 대비 보도량·첫 기사 시각
// 말은 조심스럽게: 호재·악재·예측·"때문에" 를 쓰지 않음. 등락률은 어제 종가 대비 값일 뿐
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Sparkles } from 'lucide-react';
import { stockApi } from '../../api';
import { useSession } from '../app/session';
import { errorText } from '../lib/errors';
import { dirClass, fmtPrice, fmtRate, shortTime } from '../lib/format';
import { BUZZ_TIP } from '../lib/buzz';
import IntradaySpark from './IntradaySpark';
import { TONE_TIP, ToneRing, leanOf, toneCountText } from './Tone';
import { dropPriceSentences } from '../lib/priceSentence';

/** 오늘 이 종목 기사들의 좋은·나쁜 소식 비율 (서버가 센 값, 링 = 시그니처) */
function BriefTone({ sentiment: t }) {
  if (!t || !t.articleCount || (!t.positiveCount && !t.negativeCount)) return null;
  const lean = leanOf(t.positiveCount, t.neutralCount || 0, t.negativeCount);
  // 판단한 기사가 3건 미만이면 '나쁜 소식이 더 많아요' 대신 건수 (종목 화면과 같은 규칙 — 4차 PM: 2건으로 판정)
  const few = t.articleCount < 3;
  const text = few
    ? [t.positiveCount ? `좋은 소식 ${t.positiveCount}건` : '', t.negativeCount ? `나쁜 소식 ${t.negativeCount}건` : ''].filter(Boolean).join(' · ')
    : lean.text;
  return (
    // 숫자 설명("AI가 읽은 기사 2건: 좋은 0 · 나쁜 1 …")은 마우스를 올리면 (11/16 글 줄이기: 링과 한 마디로 충분)
    <p className={`brief-tone brief-tone-${lean.kind}`} title={`${toneCountText(t.positiveCount, t.neutralCount || 0, t.negativeCount)}. ${TONE_TIP}`}>
      <ToneRing pos={t.positiveCount} neu={t.neutralCount} neg={t.negativeCount} size={22} />
      <b>{text}</b>
    </p>
  );
}

/** AI 요약 새로 만들기 (11/18 사용자: 원할 때 AI 로 다시 불러오는 버튼). 로그인 필요, 같은 종목은 서버가 10분에 한 번만 새로 만듦 */
function useRegenerate(code, name) {
  const { user, requireLogin, handleAuthError, toast } = useSession();
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState(null);
  // 로그인 뒤 이어서 할 때는 로그인 전 화면의 user(null)를 다시 보지 않게 검사 없는 doRun 을 넘김
  const run = () => (user ? doRun() : requireLogin(`${name} AI 요약 새로 만들기는 로그인하면 쓸 수 있어요.`, doRun));
  async function doRun() {
    setBusy(true);
    try {
      const res = await stockApi.regenerate(code);
      if (res?.summary) setFresh(res.summary);
      toast(res?.regenerated ? `${name} 요약을 오늘 기사로 새로 만들었어요.` : `${name}: 방금(10분 안) 만들었거나 오늘 기사가 없어 저장된 요약을 보여 드려요.`);
    } catch (err) {
      if (!handleAuthError(err)) toast(errorText(err, '요약을 새로 만들지 못했어요. 잠시 후 다시 시도해 주세요.'), 'error');
    } finally {
      setBusy(false);
    }
  }
  return { busy, fresh, run };
}

export default function BriefCard({ rank, code, name, quote, quoteLoading, priceOff, summary: summary0, digest, buzz, firstAt, articleCount, compact = false }) {
  const regen = useRegenerate(code, name);
  const summary = regen.fresh ? { ...summary0, ...regen.fresh, sentiment: summary0?.sentiment } : summary0;
  const cls = dirClass(quote?.changeRate);
  const text = dropPriceSentences(summary?.newsSummary || '');
  // '실적 3 · 외국인·기관 2' 꼬리표가 무슨 숫자인지 몰랐음 (11/16 사용자) → 큰 카드는 '오늘 나온 소식' 막대 그림, 작은 카드는 '실적 소식 3개'
  const topics = (digest?.topics || []).slice(0, 3);
  const topicBase = Math.max(1, digest?.newsCount || 0, ...topics.map((t) => t.count)); // 오늘 기사 수 대비 (카드 안 최댓값 대비면 3건·8건이 둘 다 꽉 찼음)
  const tags = [
    ...(digest?.disclosureTypes || []).map((t) => ({ key: `d-${t}`, label: `공시 · ${t}`, kind: 'accent' })),
    ...(compact ? topics.map((t) => ({ key: `t-${t.label}`, label: `${t.label} 기사 ${t.count}건`, kind: '' })) : []),
  ].slice(0, compact ? 2 : 3);
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
          {/* 11/18: 20일 흐름선 → 오늘 5분 흐름 (어제 종가 점선 위 빨강·아래 파랑). 아래 표의 작은 흐름선은 20일 그대로 */}
          <IntradaySpark code={code} name={name} quote={quote} disabled={priceOff} />
        </div>
      )}

      <div className="brief-body">
        {summary === undefined ? (
          <>
            <div className="skeleton sk-line" style={{ width: '96%' }} />
            <div className="skeleton sk-line" style={{ width: '88%' }} />
          </>
        ) : text ? (
          <>
          <p className="brief-summary">
            <Sparkles className="icon-sm brief-ai" aria-hidden="true" />
            <span className="sr-only">AI 요약: </span>
            {text}
          </p>
          {/* 버튼을 요약 글 끝에 붙였더니 두 줄 자르기에 잘려 안 보였음 (11/18 사용자: '어디 있다는 거지?') → 요약 아래 따로 한 줄 */}
          {!compact && (
            <div className="brief-ai-row">
              <span className="muted num">{summary?.generatedAt ? `AI 요약 · ${shortTime(summary.generatedAt)}에 만듦` : 'AI 요약'}</span>
              <button type="button" className="brief-regen" onClick={regen.run} disabled={regen.busy}>
                <RefreshCw className={`icon-sm ${regen.busy ? 'spin' : ''}`} aria-hidden="true" />
                {regen.busy ? '만드는 중…' : '새로 만들기'}
                <span className="sr-only"> ({name} AI 요약)</span>
              </button>
            </div>
          )}
          </>
        ) : digest?.headlines?.length ? (
          <>
            <ul className="brief-heads">
              {digest.headlines.slice(0, compact ? 1 : 2).map((h) => (
                <li key={h.id}>
                  <Link to={`/news/${h.id}`}>{h.title}</Link>
                </li>
              ))}
            </ul>
            <p className="brief-note">
              AI 요약이 아직 없어 주요 기사 제목을 보여 드려요.
              {!compact && (
                <button type="button" className="link-btn brief-regen-text" onClick={regen.run} disabled={regen.busy}>
                  {regen.busy ? '만드는 중…' : '지금 AI 요약 만들기'}
                </button>
              )}
            </p>
          </>
        ) : (
          // 기사 수가 있는데 '기사가 없어요'라 하면 모순 (11/13: 요약·기사 목록을 못 받았을 때 '기사 7건' 옆에 이렇게 나옴)
          <p className="brief-note">
            {articleCount ? '아직 AI 요약이 없어요.' : '오늘 요약할 기사가 아직 없어요.'}
            {articleCount > 0 && !compact && (
              <button type="button" className="link-btn brief-regen-text" onClick={regen.run} disabled={regen.busy}>
                {regen.busy ? '만드는 중…' : '지금 만들기'}
              </button>
            )}
          </p>
        )}
      </div>

      {/* 요약을 받는 동안 좋은·나쁜 줄 자리를 미리 (11/16 화면 밀림 측정: 받은 뒤 카드가 커져 아래 카드가 50px씩 밀림) */}
      {summary === undefined ? <div className="skeleton sk-line" style={{ width: '42%', height: 22 }} /> : <BriefTone sentiment={summary?.sentiment} />}

      {digest === null && !compact && <div className="skeleton sk-line" style={{ width: '60%', height: 64 }} />}
      {!compact && topics.length > 0 && (
        <div className="brief-topics">
          <span className="bt-k">오늘 기사 {digest?.newsCount || 0}건은 어떤 내용?</span>
          <ul>
            {topics.map((t) => (
              <li key={t.label}>
                <span className="bt-label">{t.label}</span>
                <span className="bt-bar" aria-hidden="true">
                  <i style={{ width: `${(t.count / topicBase) * 100}%` }} />
                </span>
                <span className="bt-n num">{t.count}건</span>
              </li>
            ))}
          </ul>
        </div>
      )}
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
