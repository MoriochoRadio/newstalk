// 글 상세 (넓은 단독 화면): 제목 → 출처·시각·원문 → 요약 → 연결 종목(역할·이유·근거·사실 종류) → 같은 소식 → 연결 종목 시세 → 기사 분위기
// 부품 출처: V7 ArticleDetail (연결 이유·근거 원문·사실 종류 배지, "기사 때문에 움직였다는 뜻 아님" 안내, 같은 소식)
import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ExternalLink, Info, Quote } from 'lucide-react';
import { articleApi } from '../../api';
import { SENTIMENT_LABEL, toUiArticle } from '../../api/adapters';
import { useApi } from '../../hooks/useApi';
import { useQuotes } from '../lib/useQuotes';
import { useTitle } from '../lib/hooks';
import { fmtPrice, fmtRate, dirClass, fullTime, shortTime } from '../lib/format';
import { ArticleTags, SAME_NEWS_TIP, sourceText } from '../components/ArticleRow';
import { Empty, ErrorBox, SkeletonRows } from '../components/ui';

const SENTIMENT_TEXT = {
  POSITIVE: '기사 내용이 회사에 좋은 소식 쪽이에요.',
  NEGATIVE: '기사 내용이 회사에 나쁜 소식 쪽이에요.',
  NEUTRAL: '좋고 나쁨을 가르기 어려운, 사실 전달 위주의 기사예요.',
};
const FACT_BADGE = { FACT: 'badge-ok', PLAN: 'badge-accent', FORECAST: 'badge-warn', RUMOR: 'badge-warn' };

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

function LinkedStock({ s }) {
  return (
    <div className="link-card">
      <div className="link-card-head">
        <Link to={`/stocks/${s.code}`} className="link-card-name">
          {s.name}
        </Link>
        <span className="muted num" style={{ fontSize: 'var(--fs-xs)' }}>
          {s.code}
        </span>
        <span className={`badge ${s.role === 'MAIN' ? 'badge-accent' : ''}`}>{s.roleLabel}</span>
        {s.matchType === 'INDIRECT' && <span className="badge badge-warn">간접 연결 · AI 추정</span>}
      </div>
      {s.reason && (
        <>
          <h4 className="link-label">연결 이유</h4>
          <p className="link-reason">{s.reason}</p>
        </>
      )}
      {s.evidence && (
        <>
          <h4 className="link-label">근거 원문</h4>
          <blockquote className="evidence">
            {s.factTypeLabel && (
              <span className="evidence-head">
                <span className={`badge ${FACT_BADGE[s.factType] || ''}`}>{s.factTypeLabel}</span>
              </span>
            )}
            <Quote className="icon-sm" aria-hidden="true" style={{ display: 'inline', marginRight: 6, verticalAlign: -2, color: 'var(--text-3)' }} />
            {s.evidence}
          </blockquote>
        </>
      )}
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
  const codes = (a?.relatedStocks || []).map((s) => s.code).slice(0, 5);
  const { quotes, loading: quoteLoading, disabled } = useQuotes(codes, { live: true });

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

  const mains = a.relatedStocks.filter((s) => s.role === 'MAIN');
  const others = a.relatedStocks.filter((s) => s.role !== 'MAIN');
  const raw = detail.data;
  const summaryIsTitle = a.isDisclosure || (a.summary.length === 1 && a.summary[0] === a.title);

  return (
    <article className="article-page">
      <button type="button" className="back-btn" onClick={back}>
        <ArrowLeft className="icon" aria-hidden="true" />
        뒤로
      </button>

      <header className="card">
        <div className="article-kicker">
          <span className="badge">{a.isDisclosure ? '전자공시' : a.sourceType === 'SNS' ? 'SNS' : '뉴스'}</span>
          <ArticleTags article={a} detail />
        </div>
        <h1 className="article-title">{a.title}</h1>
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

      <section className="card" aria-labelledby="sum-title">
        <div className="card-head">
          <h2 className="card-title" id="sum-title">
            {summaryIsTitle ? '내용' : 'AI 요약'}
          </h2>
          {raw.summarizedAt && <span className="muted num" style={{ fontSize: 'var(--fs-xs)' }}>{shortTime(raw.summarizedAt)} 요약</span>}
        </div>
        {summaryIsTitle ? (
          <p className="sub">공시는 제목으로만 종목을 연결했어요. 자세한 내용은 원문에서 확인해 주세요.</p>
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

      <section className="card" aria-labelledby="link-title">
        <div className="card-head">
          <h2 className="card-title" id="link-title">
            연결된 종목 <span className="count num">{a.relatedStocks.length}</span>
          </h2>
        </div>
        {a.relatedStocks.length === 0 && <p className="sub">이 글과 연결된 종목이 없어요.</p>}
        {mains.map((s) => (
          <LinkedStock key={s.code} s={s} />
        ))}
        {others.length > 0 &&
          (mains.length === 0 ? (
            others.map((s) => <LinkedStock key={s.code} s={s} />)
          ) : (
            <details className="disclosure">
              <summary>
                함께 언급된 종목 {others.length}개
                <ChevronDown className="icon-sm chev" aria-hidden="true" />
              </summary>
              {others.map((s) => (
                <LinkedStock key={s.code} s={s} />
              ))}
            </details>
          ))}
      </section>

      {a.sameNewsCount >= 2 && (
        <section className="card" aria-labelledby="same-title">
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

      {codes.length > 0 && !disabled && (
        <section className="card" aria-labelledby="quote-title">
          <div className="card-head">
            <h2 className="card-title" id="quote-title">
              연결 종목 지금 시세
            </h2>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">종목</th>
                  <th scope="col" className="r">
                    현재가
                  </th>
                  <th scope="col" className="r">
                    어제보다
                  </th>
                </tr>
              </thead>
              <tbody>
                {a.relatedStocks.slice(0, 5).map((s) => {
                  const q = quotes[s.code];
                  return (
                    <tr key={s.code}>
                      <td>
                        <Link to={`/stocks/${s.code}`} style={{ fontWeight: 600 }}>
                          {s.name}
                        </Link>
                      </td>
                      <td className="r">{q ? `${fmtPrice(q.price)}원` : quoteLoading ? <span className="skeleton" style={{ display: 'inline-block', width: 70, height: 14 }} /> : '–'}</td>
                      <td className={`r change ${dirClass(q?.changeRate)}`}>{q ? fmtRate(q.changeRate) : ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="note" style={{ marginTop: 12 }}>
            <Info className="icon-sm" aria-hidden="true" />
            어제 종가와 비교한 지금 값이에요. 기사 때문에 움직였다는 뜻이 아니에요.
          </p>
        </section>
      )}

      {a.sourceType !== 'SNS' && (
        <section className="card" aria-labelledby="mood-title">
          <div className="card-head">
            <h2 className="card-title" id="mood-title">
              기사 분위기
            </h2>
          </div>
          {raw.sentiment ? (
            <div className="sentiment-line">
              <span className="badge badge-outline" style={{ fontSize: 'var(--fs-sm)', height: 26 }}>
                {SENTIMENT_LABEL[raw.sentiment]}
              </span>
              <span className="sub">{SENTIMENT_TEXT[raw.sentiment]}</span>
            </div>
          ) : (
            <p className="sub">AI가 이 글의 분위기를 판단하지 않았어요.</p>
          )}
          <p className="card-note">AI가 기사 문장만 읽고 나눈 거예요. 주가가 오르거나 내린다는 예측이 아니에요.</p>
        </section>
      )}

      {a.relatedSns.length > 0 && (
        <section className="card" aria-labelledby="sns-title">
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
