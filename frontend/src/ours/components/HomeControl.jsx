// 홈 '한눈에' 보기 (11/18 사용자 실험: 토스증권 첫 화면처럼 컨트롤 센터 — 스크롤 없이 한 화면에 모든 정보)
// 실험 브랜치 test/fe-dashboard-compact 전용. 기본 홈은 그대로 두고 머리의 '기본 / 한눈에' 단추로 바꿈
// 칸 배치 (넓은 화면 12칸): ① 오늘 숫자 띠(전체) ② 시장 지도 5 · 화제 종목 순위 4 · 화제 종목 중 등락 3 ③ 오늘 주요 소식 6 · 많이 다룬 주제 3 · 오늘 공시 3
// 새 데이터를 부르지 않음: 홈이 이미 받은 오늘 기사·이슈 순위·현재가·시장 지도를 나눠 그림 (API 호출 수 그대로)
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import HomeKpi from './HomeKpi';
import CapMap, { CapLegend } from './CapMap';
import Movers from './Movers';
import { StoryFeed } from './ArticleRow';
import { dirClass, fmtPrice, fmtRate } from '../lib/format';
import { limitOf } from './ui';

const RANK_N = 10;

function Card({ title, to, more = '전체', className = '', children }) {
  return (
    <section className={`card cc-card ${className}`}>
      <div className="cc-head">
        <h2 className="cc-title">{title}</h2>
        {to && (
          <Link to={to} className="cc-more">
            {more}
            <ChevronRight className="icon-sm" aria-hidden="true" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export default function HomeControl({ items, newsArticles, issueItems, quotes, quoteLoading, priceOff, capMap, capNews, topics, feedAt }) {
  const disclosures = items.filter((a) => a.isDisclosure);
  const maxCount = Math.max(1, ...issueItems.slice(0, RANK_N).map((i) => i.articleCount));
  const topicMax = Math.max(1, ...topics.map((t) => t.count));
  return (
    <div className="cc">
      <HomeKpi articles={newsArticles} disclosureCount={disclosures.length} updatedAt={feedAt} />

      <div className="cc-grid">
        <Card title="시장 지도" to="/map" more="크게" className="cc-map">
          {capMap.data?.items?.length ? (
            <>
              <CapMap items={capMap.data.items.map((it) => ({ ...it, sector: '', sectorName: it.sector }))} news={capNews} height={286} limit={16} maxShare={0.16} />
              <CapLegend size="시가총액" grouped={false} asOf={capMap.data.fetchedAt} />
            </>
          ) : capMap.error || capMap.data ? (
            <CapMap
              sizeKind="news"
              items={issueItems.map((it) => ({
                stockCode: it.stockCode,
                stockName: it.stockName,
                sector: '',
                marketCap: it.articleCount,
                changeRate: quotes[it.stockCode]?.changeRate ?? null,
                priceLimit: { up: 'UPPER', down: 'LOWER' }[limitOf(quotes[it.stockCode])] ?? null,
              }))}
              height={286}
              limit={16}
            />
          ) : (
            <div className="skeleton" style={{ height: 286, borderRadius: 'var(--radius-sm)' }} />
          )}
        </Card>

        <Card title="오늘 화제 종목" to="/stocks" className="cc-rank">
          {issueItems.length === 0 ? (
            <p className="sub">오늘 기사에 나온 종목이 아직 없어요.</p>
          ) : (
            <ol className="cc-rank-list">
              {issueItems.slice(0, RANK_N).map((it) => {
                const q = quotes[it.stockCode];
                return (
                  <li key={it.stockCode}>
                    <Link to={`/stocks/${it.stockCode}`} className="cc-rank-row">
                      <span className="cc-rank-n num">{it.rank}</span>
                      <span className="cc-rank-name">{it.stockName}</span>
                      <span className="cc-rank-bar" aria-hidden="true">
                        <i style={{ width: `${(it.articleCount / maxCount) * 100}%` }} />
                      </span>
                      <span className="cc-rank-cnt num">{it.articleCount}건</span>
                      {!priceOff && (
                        <span className="cc-rank-price num">
                          {q ? fmtPrice(q.price) : quoteLoading ? '' : '–'}
                        </span>
                      )}
                      {!priceOff && <span className={`cc-rank-rate num ${dirClass(q?.changeRate)}`}>{q ? fmtRate(q.changeRate) : ''}</span>}
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>

        <div className="cc-movers">
          {issueItems.length > 0 && <Movers issues={issueItems} quotes={quotes} disabled={priceOff} loading={quoteLoading} top={4} title="화제 종목 중 등락" />}
        </div>

        <Card title="오늘 주요 소식" to="/news?period=today" className="cc-news">
          {newsArticles.length === 0 ? <p className="sub">오늘 기사가 아직 없어요.</p> : <StoryFeed articles={newsArticles.slice(0, 40)} dense className="feed cc-feed" />}
        </Card>

        <Card title="많이 다룬 주제" className="cc-topics">
          {topics.length === 0 ? (
            <p className="sub">아직 없어요.</p>
          ) : (
            <ul className="cc-topic-list">
              {topics.map((t) => (
                <li key={t.label}>
                  <span className="cc-topic-label">{t.label}</span>
                  <span className="cc-topic-bar" aria-hidden="true">
                    <i style={{ width: `${(t.count / topicMax) * 100}%` }} />
                  </span>
                  <span className="cc-topic-n num">{t.count}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="cc-note">숫자 = 그 주제를 다룬 소식 수 (같은 소식은 한 번)</p>
        </Card>

        <Card title="오늘 공시" to="/news?tab=disclosure&period=today" className="cc-disc">
          {disclosures.length === 0 ? <p className="sub">오늘 공시가 아직 없어요.</p> : <StoryFeed articles={disclosures.slice(0, 12)} dense className="feed cc-feed" />}
        </Card>
      </div>
    </div>
  );
}
