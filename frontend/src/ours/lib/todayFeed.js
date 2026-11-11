// 오늘 0시부터 나온 글 전부 (홈의 시간대별 보도량·오늘 숫자·주요 뉴스·이슈 종목 "왜" 한 줄에 같이 씀)
// GET /api/articles?period=today 를 100건씩 차례로 받음. 오늘 글이 300건이면 3번 (KIS 시세와 무관한 우리 DB 조회)
// MAX_PAGES 를 넘으면 complete: false → 화면은 "최근 n건 기준"이라고 밝힘 (받은 범위로 전체를 지어내지 않음)
import { articleApi } from '../../api';
import { toUiArticle } from '../../api/adapters';

const SIZE = 100;
const MAX_PAGES = 10;
const KST_MS = 9 * 3600 * 1000;

export async function loadTodayFeed(signal) {
  let items = [];
  let total = 0;
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const res = await articleApi.list({ period: 'today', size: SIZE, page }, { signal });
    total = res?.totalCount ?? 0;
    items = items.concat((res?.items || []).map(toUiArticle));
    if (items.length >= total || (res?.items || []).length < SIZE) break;
  }
  return { items, total, complete: items.length >= total };
}

/** 한국 시간 몇 시인가 (0~23) */
export const kstHour = (iso) => new Date(new Date(iso).getTime() + KST_MS).getUTCHours();

/** 시간대별 글 수: [{ hour, news, disclosure }] 0시부터 지금 시각까지 */
export function hourlyCounts(items, now = new Date()) {
  const last = kstHour(now.toISOString());
  const rows = Array.from({ length: last + 1 }, (_, hour) => ({ hour, news: 0, disclosure: 0 }));
  for (const a of items) {
    if (!a.publishedAtIso) continue;
    const h = kstHour(a.publishedAtIso);
    if (!rows[h]) continue;
    if (a.isDisclosure) rows[h].disclosure += 1;
    else rows[h].news += 1;
  }
  return rows;
}

/**
 * 종목의 "왜" 한 줄 = 그 종목이 주인공인 오늘 최신 뉴스 제목 (없으면 공시가 아닌 첫 글, 그것도 없으면 첫 글)
 * items 는 최신순이라 처음 찾은 것이 가장 최근
 */
export function pickWhy(items, code) {
  const mine = items.filter((a) => a.relatedStocks.some((s) => s.code === code));
  const pick =
    mine.find((a) => !a.isDisclosure && a.relatedStocks.some((s) => s.code === code && s.role === 'MAIN')) ||
    mine.find((a) => !a.isDisclosure) ||
    mine[0];
  return pick ? { id: pick.id, title: pick.title } : null;
}
