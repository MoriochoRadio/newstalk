// 홈 '한눈에' 보기 = 컨트롤 센터 (11/18, 브랜치 test/fe-dashboard-compact 에서 만들어 main 반영)
// "간편하게 보고 싶은 사람은 원래 홈, 한눈에·전문적인 화면을 원하면 단추로 컨트롤 센터"
// 원칙: 큰 숫자·큰 글자 없음(11~13px), 둥근 카드 대신 각진 칸 + 얇은 선, 빈 곳 없이 그러나 숨 쉴 틈은 남김
// 배치 (넓은 화면 12칸): ① 지표 줄(전체) ② 업종별 시장 지도 6 · 화제 종목 순위 3 · 등락 3 ③ 주요 소식 6 · 주제 3 · 공시 3
// 새 데이터를 부르지 않음: 홈이 이미 받은 오늘 기사·이슈 순위·현재가·시장 지도를 나눠 그림
import { Link } from 'react-router-dom';
import CapMap from './CapMap';
import { StoryFeed } from './ArticleRow';
import { countsOf } from './Tone';
import { dirClass, fmtPrice, fmtRate, shortTime } from '../lib/format';
import { limitOf } from './ui';
import { marketState } from '../lib/market';

const RANK_N = 12;
const MOVERS_N = 6;

function Panel({ title, to, more = '전체', className = '', right = null, children }) {
  return (
    <section className={`cc-panel ${className}`}>
      <header className="cc-ph">
        <h2 className="cc-pt">{title}</h2>
        <span className="cc-ph-right">
          {right}
          {to && (
            <Link to={to} className="cc-more">
              {more} ›
            </Link>
          )}
        </span>
      </header>
      <div className="cc-pb">{children}</div>
    </section>
  );
}

/** 맨 위 지표 줄: 증권 앱의 지수 띠처럼 작은 글자로 한 줄 (큰 숫자 대신) */
function StatBar({ newsArticles, disclosureCount, issueItems, quotes, feedAt }) {
  const t = countsOf(
    newsArticles
      .filter((a) => !a.titleOnly && !a.disclosurePending)
      .map((a) => (a.relatedStocks.find((s) => s.role === 'MAIN') || a.relatedStocks[0])?.sentiment)
  );
  const read = t.pos + t.neu + t.neg || 1;
  const pct = (n) => Math.round((n / read) * 100);
  const rates = issueItems.map((i) => quotes[i.stockCode]?.changeRate).filter((r) => r != null);
  const up = rates.filter((r) => r > 0).length;
  const down = rates.filter((r) => r < 0).length;
  const presses = new Set(newsArticles.map((a) => a.press).filter(Boolean)).size;
  const st = marketState();
  return (
    <div className="cc-stat" role="group" aria-label="오늘 지표">
      <span className="cc-s">
        <i>기사</i>
        <b className="num">{newsArticles.length.toLocaleString('ko-KR')}</b>
      </span>
      <span className="cc-s">
        <i>공시</i>
        <b className="num">{disclosureCount.toLocaleString('ko-KR')}</b>
      </span>
      <span className="cc-s">
        <i>언론사</i>
        <b className="num">{presses}</b>
      </span>
      <span className="cc-s cc-s-tone">
        <i>분위기</i>
        <span className="cc-tonebar" aria-hidden="true">
          <em className="pos" style={{ width: `${pct(t.pos)}%` }} />
          <em className="neu" style={{ width: `${pct(t.neu)}%` }} />
          <em className="neg" style={{ width: `${pct(t.neg)}%` }} />
        </span>
        <b className="num good">좋은 {pct(t.pos)}%</b>
        <b className="num">중립 {pct(t.neu)}%</b>
        <b className="num bad">나쁜 {pct(t.neg)}%</b>
      </span>
      <span className="cc-s">
        <i>화제 {issueItems.length}종목</i>
        <b className="num up">▲{up}</b>
        <b className="num down">▼{down}</b>
      </span>
      <span className="cc-s cc-s-end">
        <i>{st.label}</i>
        <b className="num">{feedAt ? `${shortTime(feedAt)} 갱신` : ''}</b>
      </span>
    </div>
  );
}

export default function HomeControl({ items, newsArticles, issueItems, quotes, quoteLoading, priceOff, capMap, capNews, topics, feedAt }) {
  const disclosures = items.filter((a) => a.isDisclosure);
  const maxCount = Math.max(1, ...issueItems.slice(0, RANK_N).map((i) => i.articleCount));
  const topicMax = Math.max(1, ...topics.map((t) => t.count));
  const withRate = issueItems.map((i) => ({ ...i, q: quotes[i.stockCode] })).filter((x) => x.q?.changeRate != null);
  const gainers = withRate.filter((x) => x.q.changeRate > 0).sort((a, b) => b.q.changeRate - a.q.changeRate).slice(0, MOVERS_N);
  const losers = withRate.filter((x) => x.q.changeRate < 0).sort((a, b) => a.q.changeRate - b.q.changeRate).slice(0, MOVERS_N);

  const moverRows = (list, empty) =>
    list.length === 0 ? (
      <p className="cc-empty">{empty}</p>
    ) : (
      list.map((x) => (
        <Link key={x.stockCode} to={`/stocks/${x.stockCode}`} className="cc-row cc-mv">
          <span className="cc-name">{x.stockName}</span>
          <span className="num cc-dim">{fmtPrice(x.q.price)}</span>
          <span className={`num cc-rate ${dirClass(x.q.changeRate)}`}>
            {fmtRate(x.q.changeRate)}
            {limitOf(x.q) ? <span className="cc-limit">{limitOf(x.q) === 'up' ? '상' : '하'}</span> : null}
          </span>
        </Link>
      ))
    );

  return (
    <div className="cc">
      <StatBar newsArticles={newsArticles} disclosureCount={disclosures.length} issueItems={issueItems} quotes={quotes} feedAt={feedAt} />

      <div className="cc-grid">
        <Panel
          title="시장 지도"
          to="/map"
          more="크게"
          className="cc-map"
          right={capMap.data?.fetchedAt ? <span className="cc-dim num">크기 시가총액 · 색 등락 · {shortTime(capMap.data.fetchedAt)}</span> : null}
        >
          {capMap.data?.items?.length ? (
            <CapMap pro items={capMap.data.items} news={capNews} height={372} limit={40} maxShare={0.14} />
          ) : capMap.error || capMap.data ? (
            <CapMap
              pro
              sizeKind="news"
              items={issueItems.map((it) => ({
                stockCode: it.stockCode,
                stockName: it.stockName,
                sector: '',
                marketCap: it.articleCount,
                changeRate: quotes[it.stockCode]?.changeRate ?? null,
                priceLimit: { up: 'UPPER', down: 'LOWER' }[limitOf(quotes[it.stockCode])] ?? null,
              }))}
              height={372}
              limit={24}
            />
          ) : (
            <div className="skeleton" style={{ height: 372 }} />
          )}
        </Panel>

        <Panel title="화제 종목" to="/stocks" className="cc-rank" right={<span className="cc-dim">오늘 기사 수</span>}>
          {issueItems.length === 0 ? (
            <p className="cc-empty">오늘 기사에 나온 종목이 아직 없어요.</p>
          ) : (
            issueItems.slice(0, RANK_N).map((it) => {
              const q = quotes[it.stockCode];
              return (
                <Link key={it.stockCode} to={`/stocks/${it.stockCode}`} className="cc-row cc-rk">
                  <span className="num cc-dim">{it.rank}</span>
                  <span className="cc-name">{it.stockName}</span>
                  <span className="cc-bar" aria-hidden="true">
                    <i style={{ width: `${(it.articleCount / maxCount) * 100}%` }} />
                  </span>
                  <span className="num">{it.articleCount}</span>
                  <span className={`num cc-rate ${dirClass(q?.changeRate)}`}>{priceOff ? '' : q ? fmtRate(q.changeRate) : quoteLoading ? '' : '–'}</span>
                </Link>
              );
            })
          )}
        </Panel>

        <Panel title="화제 종목 중 등락" className="cc-movers">
          {priceOff ? (
            <p className="cc-empty">시세 준비 중</p>
          ) : (
            <>
              <p className="cc-sub">오른</p>
              {moverRows(gainers, '오른 종목이 없어요')}
              <p className="cc-sub">내린</p>
              {moverRows(losers, '내린 종목이 없어요')}
            </>
          )}
        </Panel>

        <Panel title="주요 소식" to="/news?period=today" className="cc-news">
          {newsArticles.length === 0 ? <p className="cc-empty">오늘 기사가 아직 없어요.</p> : <StoryFeed articles={newsArticles.slice(0, 40)} dense className="feed cc-feed" />}
        </Panel>

        <Panel title="많이 다룬 주제" className="cc-topics" right={<span className="cc-dim">소식 수</span>}>
          {topics.length === 0 ? (
            <p className="cc-empty">아직 없어요.</p>
          ) : (
            topics.map((t) => (
              <div key={t.label} className="cc-row cc-tp">
                <span className="cc-name">{t.label}</span>
                <span className="cc-bar" aria-hidden="true">
                  <i style={{ width: `${(t.count / topicMax) * 100}%` }} />
                </span>
                <span className="num">{t.count}</span>
              </div>
            ))
          )}
        </Panel>

        <Panel title="공시" to="/news?tab=disclosure&period=today" className="cc-disc" right={<span className="cc-dim num">{disclosures.length}건</span>}>
          {disclosures.length === 0 ? <p className="cc-empty">오늘 공시가 아직 없어요.</p> : <StoryFeed articles={disclosures.slice(0, 14)} dense className="feed cc-feed" />}
        </Panel>
      </div>
    </div>
  );
}
