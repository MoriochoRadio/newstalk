// 글 상세 (넓은 단독 화면): 제목 → 좋은·나쁜 소식 띠 → 출처·시각·원문 → 요약 → 연결 종목(역할·이유·근거·사실 종류·판단) → 같은 소식 → 연결 종목 시세
// 부품 출처: V7 ArticleDetail (연결 이유·근거 원문·사실 종류 배지, "기사 때문에 움직였다는 뜻 아님" 안내, 같은 소식)
import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Quote } from 'lucide-react';
import { articleApi } from '../../api';
import { toUiArticle } from '../../api/adapters';
import { useApi } from '../../hooks/useApi';
import { useQuotes } from '../lib/useQuotes';
import { useTitle } from '../lib/hooks';
import { fmtPrice, fmtRate, dirClass, fullTime, shortTime } from '../lib/format';
import { explainDisclosure } from '../lib/disclosureGlossary';
import { ArticleTags, SAME_NEWS_TIP, sourceText } from '../components/ArticleRow';
import { TONE_TIP, ToneRing, countsOf } from '../components/Tone';
import { Empty, ErrorBox, SkeletonRows } from '../components/ui';

// 사실 종류 표시는 좋은·나쁜 소식 색(초록·호박)과 가격 색(파랑)을 쓰지 않음 (11/16 리뷰: '일어난 일'이 초록이라 좋은 소식처럼 보임)
const FACT_BADGE = { FACT: '', PLAN: '', FORECAST: 'badge-outline', RUMOR: 'badge-outline' };

/** 브라우저 기록이 있으면 뒤로, 바로 들어온 주소면 목록으로 */
export function useBack(fallback) {
  const navigate = useNavigate();
  return () => {
    if ((window.history.state?.idx ?? 0) > 0) navigate(-1);
    else navigate(fallback);
  };
}

/**
 * 같은 소식으로 묶인 다른 기사: API 에 묶음 번호가 없어서 주인공 종목의 최근 7일 글 중
 * 묶음 크기·첫 보도 언론사가 같고 24시간 안인 글을 찾음 (드물게 다른 묶음이 섞일 수 있음)
 */
async function loadSameNews(a, signal) {
  const main = a.relatedStocks.find((s) => s.role === 'MAIN') || a.relatedStocks[0];
  if (!main || !(main.sameNewsCount >= 2)) return [];
  const res = await articleApi.list({ stockCode: main.code, period: '7d', size: 100 }, { signal });
  const t0 = new Date(a.publishedAtIso).getTime();
  return (res?.items || [])
    .map(toUiArticle)
    .filter((x) => {
      if (x.id === a.id) return false;
      const s = x.relatedStocks.find((r) => r.code === main.code);
      if (!s || s.sameNewsCount !== main.sameNewsCount || s.firstReportPress !== main.firstReportPress) return false;
      return Math.abs(new Date(x.publishedAtIso).getTime() - t0) <= 24 * 3600 * 1000;
    })
    .sort((x, y) => (x.publishedAtIso > y.publishedAtIso ? 1 : -1));
}

/** 종목 하나에 대한 판단 알약 (종목마다 다를 수 있음: 유가 급등 → 정유 좋음, 항공 나쁨) */
function StockTone({ sentiment }) {
  if (sentiment !== 'POSITIVE' && sentiment !== 'NEGATIVE') return null;
  const pos = sentiment === 'POSITIVE';
  return (
    <span className={`tone ${pos ? 'tone-pos' : 'tone-neg'}`} title={TONE_TIP}>
      <ToneRing {...(pos ? { pos: 1 } : { neg: 1 })} size={14} />
      <i aria-hidden="true" />
      {pos ? '좋은 소식' : '나쁜 소식'}
    </span>
  );
}

/** 맨 위 판단 띠 (11/12 사용자: "기사 분위기가 맨 밑에만 있어서 다 읽고 나서야 좋은지 나쁜지 나온다. 의미가 없다")
 *  → 제목 바로 아래에, 연결 종목마다 "○○에 좋은 소식". 판단한 종목이 없으면 안 보임 */
function ToneBand({ article }) {
  const judged = (article.relatedStocks || []).filter((s) => s.sentiment === 'POSITIVE' || s.sentiment === 'NEGATIVE');
  if (article.titleOnly || article.disclosurePending || article.sourceType === 'SNS' || judged.length === 0) return null;
  const c = countsOf(judged.map((s) => s.sentiment));
  const lead = judged.find((s) => s.role === 'MAIN') || judged[0];
  const kind = c.pos && c.neg ? 'mixed' : c.pos ? 'pos' : 'neg';
  return (
    <div className={`tone-band tone-band-${kind}`}>
      <ToneRing {...c} size={40} className="tone-band-ring" />
      <div className="tone-band-text">
        {/* 여러 종목이면 좋은·나쁜 소식으로 묶어 한 줄씩 (11/16: "OO에 좋은 소식"이 종목 수만큼 되풀이돼 글이 길었음) */}
        {judged.length === 1 ? (
          // '○○에 좋은 소식이에요'는 단정으로 읽힘 (11/16 밤 PM) → 누가 그렇게 봤는지 밝힘
          // 판단한 종목이 중심 종목이 아니면 '함께 언급된'을 붙임 (11/17: 중심 종목 우진은 판단 없음인데 'AI는 우진엔텍에 나쁜 소식'만 떠
          // 우진엔텍 기사처럼 읽혔음. 목록의 '함께 언급 · ' 꼬리표와 같은 규칙)
          <p className="tone-band-main">{`AI는 ${lead.role === 'MAIN' ? '' : '함께 언급된 '}${lead.name}에 ${lead.sentiment === 'POSITIVE' ? '좋은 소식' : '나쁜 소식'}으로 봤어요`}</p>
        ) : (
          ['POSITIVE', 'NEGATIVE']
            .map((t) => [t, judged.filter((x) => x.sentiment === t)])
            .filter(([, list]) => list.length)
            .map(([t, list]) => (
              <p key={t} className="tone-band-main tone-band-group">
                <span className={t === 'POSITIVE' ? 'tb-pos' : 'tb-neg'}>{t === 'POSITIVE' ? '좋은 소식' : '나쁜 소식'}</span>
                <span className="tb-names">{list.map((x) => x.name).join(' · ')}</span>
              </p>
            ))
        )}
        {/* 11/13 준호(글 안 읽음): 두 줄 → 한 줄. 뜻(AI 판단 · 주가 예측 아님)은 그대로 */}
        <p className="tone-band-sub">{article.isDisclosure ? '공시' : '기사'} 내용만 본 판단 · 주가 예측이 아니에요</p>
      </div>
    </div>
  );
}

/** 연결 지도의 종목 카드: 주인공은 크게(이유·근거 다 보임), 함께 언급은 작게, 간접 연결은 점선 + "AI 추정" */
function LinkCard({ s, quote, priceOff, disclosure = false, sameEvidence = false }) {
  const indirect = s.matchType === 'INDIRECT';
  const cls = s.role === 'MAIN' ? 'is-main' : 'is-mentioned';
  return (
    <div className={`lmap-card ${cls} ${indirect ? 'is-indirect' : ''}`}>
      <div className="lmap-head">
        <Link to={`/stocks/${s.code}`} className="lmap-name">
          {s.name}
        </Link>
        <span className={`badge ${s.role === 'MAIN' ? 'badge-accent' : ''}`}>{s.roleLabel}</span>
        {indirect && <span className="badge badge-warn">간접 연결 · AI 추정</span>}
        <StockTone sentiment={s.sentiment} />
        {!priceOff && quote && (
          <span className="lmap-quote num">
            {fmtPrice(quote.price)} <span className={`change ${dirClass(quote.changeRate)}`}>{fmtRate(quote.changeRate)}</span>
          </span>
        )}
      </div>
      {/* 역할 한 줄은 배지·묶음 이름(주인공/함께 언급)과 같은 말이라 뺌 (11/16 글 줄이기). 간접 연결·공시만 남김 */}
      {(indirect || disclosure) && (
        <p className="lmap-role">{indirect ? '기사에 쓰인 사건이 이 업종에 닿는다고 AI가 추정했어요' : '이 공시를 낸 회사예요'}</p>
      )}
      {s.evidence && sameEvidence ? (
        <p className="lmap-same">↑ 같은 근거 문장</p>
      ) : s.evidence ? (
        <blockquote className="lmap-evidence">
          {s.factTypeLabel && <span className={`badge ${FACT_BADGE[s.factType] || ''}`}>{s.factTypeLabel}</span>}
          <span className="sr-only">근거 원문: </span>
          <Quote className="icon-sm" aria-hidden="true" style={{ display: 'inline', marginRight: 4, verticalAlign: -2, color: 'var(--text-3)' }} />
          <span className="mark">{s.evidence}</span>
        </blockquote>
      ) : (
        !s.reason && <p className="lmap-reason sub">기사 제목에서 회사 이름을 찾아 연결했어요.</p>
      )}
      {s.reason && (
        <p className="lmap-memo">
          <span>AI 메모</span> {s.reason}
        </p>
      )}
    </div>
  );
}

/**
 * 연결 지도: 왼쪽(휴대폰은 위) 기사 → 선 → 오른쪽 종목 카드. 주인공 먼저 크게, 함께 언급은 두 줄 격자로 작게
 * 연결 이유·근거 원문·사실 종류(일어난 일·회사 계획·전망·소문)는 V7 의 "잘 된 점"을 그대로 살림
 */
function LinkMap({ a, quotes, priceOff }) {
  const mains = a.relatedStocks.filter((s) => s.role === 'MAIN');
  const others = a.relatedStocks.filter((s) => s.role !== 'MAIN');
  // 같은 근거 문장이 여러 종목에 붙으면 처음 한 번만 보여 줌 (11/16: 보험 3사 기사에 같은 문장이 세 번)
  const seen = new Set();
  const repeated = new Set();
  [...mains, ...others].forEach((s) => {
    if (!s.evidence) return;
    if (seen.has(s.evidence)) repeated.add(s.code);
    seen.add(s.evidence);
  });
  return (
    <div className="lmap">
      <div className="lmap-node">
        <p className="lmap-node-kicker">{a.isDisclosure ? '이 공시' : '이 기사'}</p>
        <p className="lmap-node-title">{a.title}</p>
        <p className="lmap-node-meta num">
          {sourceText(a)} · {shortTime(a.publishedAtIso)}
        </p>
      </div>
      <div className="lmap-branch">
        {mains.length > 0 && <p className="lmap-group">중심 종목 {mains.length}</p>}
        {mains.map((s) => (
          <LinkCard key={s.code} s={s} quote={quotes[s.code]} priceOff={priceOff} disclosure={a.isDisclosure} sameEvidence={repeated.has(s.code)} />
        ))}
        {others.length > 0 && <p className="lmap-group">함께 언급 {others.length}</p>}
        {others.length > 0 && (
          <div className="lmap-grid">
            {others.map((s) => (
              <LinkCard key={s.code} s={s} quote={quotes[s.code]} priceOff={priceOff} sameEvidence={repeated.has(s.code)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// 글이 바뀌면(같은 소식 목록에서 이동) 화면 전체를 새로 그림
export default function NewsDetailPage() {
  const { id } = useParams();
  return <NewsDetail key={id} id={id} />;
}

function NewsDetail({ id }) {
  const back = useBack('/news');
  const detail = useApi((signal) => articleApi.get(id, { signal }), [id]);
  const a = useMemo(() => (detail.data ? toUiArticle(detail.data) : null), [detail.data]);
  useTitle(a?.title || '뉴스');

  const same = useApi((signal) => (a ? loadSameNews(a, signal) : Promise.resolve([])), [a?.id], { enabled: Boolean(a) });
  const codes = (a?.relatedStocks || []).map((s) => s.code).slice(0, 10);
  const { quotes, disabled } = useQuotes(codes, { live: true });

  if (detail.loading && !a) {
    return (
      <div className="article-page">
        <button type="button" className="back-btn" onClick={back}>
          <ArrowLeft className="icon" aria-hidden="true" />
          뒤로
        </button>
        <div className="card">
          <SkeletonRows rows={5} />
        </div>
      </div>
    );
  }
  if (detail.error) {
    return (
      <div className="article-page">
        <button type="button" className="back-btn" onClick={back}>
          <ArrowLeft className="icon" aria-hidden="true" />
          뒤로
        </button>
        {detail.error.status === 404 ? (
          <div className="card">
            <Empty title="글을 찾을 수 없어요" desc="지워졌거나 아직 분석이 끝나지 않은 글이에요." action={<Link to="/news" className="btn btn-secondary btn-sm">뉴스 목록으로</Link>} />
          </div>
        ) : (
          <ErrorBox error={detail.error} onRetry={detail.reload} />
        )}
      </div>
    );
  }
  if (!a) return null;

  const raw = detail.data;
  // 공시도 원문을 AI 가 요약함 (summarizedAt 있음). 요약 전 공시만 요약 칸에 제목이 들어 있음 (11/13: 요약이 있는데도 '제목으로만'이라 나오던 것)
  const summaryIsTitle = a.isDisclosure ? a.disclosurePending : a.summary.length === 1 && a.summary[0] === a.title;

  return (
    <article className="article-page ad-grid">
      <button type="button" className="back-btn" onClick={back}>
        <ArrowLeft className="icon" aria-hidden="true" />
        뒤로
      </button>

      <header className="card ad-head">
        <div className="article-kicker">
          <span className="badge">{a.isDisclosure ? '전자공시' : a.sourceType === 'SNS' ? 'SNS' : '뉴스'}</span>
          <ArticleTags article={a} detail />
        </div>
        <h1 className="article-title">{a.title}</h1>
        {a.isDisclosure && explainDisclosure(a.disclosureType) && (
          <p className="disclosure-explain">
            <b>{a.disclosureType}</b> {explainDisclosure(a.disclosureType)}
          </p>
        )}
        <ToneBand article={a} />
        <div className="article-meta">
          <span>{sourceText(a)}</span>
          {raw.reporter && <span>{raw.reporter} 기자</span>}
          <time className="num" dateTime={a.publishedAtIso || undefined}>
            {fullTime(a.publishedAtIso)}
          </time>
          {a.url && (
            <a className="btn btn-secondary btn-sm" href={a.url} target="_blank" rel="noreferrer">
              원문 보기
              <ExternalLink className="icon-sm" aria-hidden="true" />
              <span className="sr-only">(새 창)</span>
            </a>
          )}
        </div>
      </header>

      <section className="card ad-sum" aria-labelledby="sum-title">
        <div className="card-head">
          <h2 className="card-title" id="sum-title">
            {summaryIsTitle ? '내용' : 'AI 요약'}
          </h2>
          {raw.summarizedAt && <span className="muted num" style={{ fontSize: 'var(--fs-xs)' }}>{shortTime(raw.summarizedAt)} 요약</span>}
        </div>
        {summaryIsTitle ? (
          <p className="sub">공시 원문을 아직 요약하지 못했어요. 자세한 내용은 원문에서 확인해 주세요.</p>
        ) : a.hasSummary ? (
          <ul className="summary-list">
            {a.summary.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        ) : (
          <p className="sub">AI 활용을 허락하지 않은 언론사라 요약하지 않고 제목으로만 종목을 연결했어요. 내용은 원문에서 확인해 주세요.</p>
        )}
        {a.keywords.length > 0 && (
          <div className="tags" style={{ marginTop: 14 }}>
            {a.keywords.slice(0, 8).map((k) => (
              <span key={k} className="kw">
                {k}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="card ad-link" aria-labelledby="link-title">
        <div className="card-head">
          <h2 className="card-title" id="link-title">
            연결 지도 <span className="count num">종목 {a.relatedStocks.length}</span>
          </h2>
        </div>
        {a.relatedStocks.length === 0 ? <p className="sub">이 글과 연결된 종목이 없어요.</p> : <LinkMap a={a} quotes={quotes} priceOff={disabled} />}
      </section>

      {a.sameNewsCount >= 2 && (
        <section className="card ad-same" aria-labelledby="same-title">
          <div className="card-head">
            <h2 className="card-title" id="same-title">
              같은 소식 <span className="count num">{a.sameNewsCount}건</span>
            </h2>
            {a.firstReportPress && <span className="muted" style={{ fontSize: 'var(--fs-sm)' }}>첫 보도 {a.firstReportPress}</span>}
          </div>
          {same.loading && !same.data && <SkeletonRows rows={2} compact />}
          {same.data && same.data.length > 0 && (
            <ul className="feed feed-compact">
              {same.data.map((x) => (
                <li key={x.id} className="feed-row">
                  <Link to={`/news/${x.id}`} className="feed-title">
                    {x.title}
                  </Link>
                  <div className="feed-meta">
                    <span>{x.press}</span>
                    <span className="dot num">{shortTime(x.publishedAtIso)}</span>
                    {x.firstReport && <span className="badge">첫 보도</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {same.data && same.data.length === 0 && <p className="sub">다른 기사는 목록에서 찾지 못했어요.</p>}
          <p className="card-note">{SAME_NEWS_TIP}</p>
        </section>
      )}

      {a.relatedSns.length > 0 && (
        <section className="card ad-sns" aria-labelledby="sns-title">
          <div className="card-head">
            <h2 className="card-title" id="sns-title">
              같은 시간대 SNS
            </h2>
            <span className="badge badge-warn">참고용 · 확인되지 않은 정보</span>
          </div>
          <ul className="feed feed-compact">
            {a.relatedSns.map((s) => (
              <li key={s.id} className="feed-row">
                <a href={s.url} target="_blank" rel="noreferrer" className="feed-title">
                  {s.title}
                </a>
                <div className="feed-meta">
                  <span>{s.press}</span>
                  <span className="dot num">{s.publishedAt.slice(5)}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
