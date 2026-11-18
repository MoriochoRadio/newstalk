// 오늘 0시부터 나온 글 전부 (홈의 뉴스 지도·오늘 숫자·주요 소식, 시장 지도의 "왜" 한 줄에 같이 씀)
// GET /api/articles?period=today 를 100건씩 받음. 오늘 글이 300건이면 3번 (첫 쪽 뒤 나머지는 한꺼번에, KIS 시세와 무관한 우리 DB 조회)
// MAX_PAGES 를 넘으면 complete: false → 화면은 "최근 n건 기준"이라고 밝힘 (받은 범위로 전체를 지어내지 않음)
import { articleApi } from '../../api';
import { toUiArticle } from '../../api/adapters';

const SIZE = 100;
const MAX_PAGES = 10;

export async function loadTodayFeed(signal) {
  // 첫 쪽으로 전체 수를 안 뒤 나머지 쪽은 한꺼번에 (11/13 로딩 개선: 한 쪽씩 차례로 기다리던 것)
  const first = await articleApi.list({ period: 'today', size: SIZE, page: 1 }, { signal });
  const total = first?.totalCount ?? 0;
  const pages = Math.min(MAX_PAGES, Math.ceil(total / SIZE));
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, pages - 1) }, (_, i) => articleApi.list({ period: 'today', size: SIZE, page: i + 2 }, { signal }))
  );
  // 받는 사이 새 글이 들어오면 쪽이 밀려 같은 글이 두 번 올 수 있음 → id 로 한 번만
  const seen = new Set();
  const items = [first, ...rest]
    .flatMap((res) => (res?.items || []).map(toUiArticle))
    .filter((a) => (seen.has(a.id) ? false : seen.add(a.id)));
  return { items, total, complete: items.length >= total };
}

/**
 * 종목의 "왜" 한 줄 = 그 종목이 주인공인 오늘 최신 뉴스 제목 (없으면 공시가 아닌 첫 글, 그것도 없으면 첫 글)
 * items 는 최신순이라 처음 찾은 것이 가장 최근
 */
export function pickWhy(items, code) {
  // 시세 기사('하이닉스 2%대 하락' 같은 주가 움직임 기사)는 뺌: 등락 칸 안에 두면 원인처럼 읽히고 숫자도 지금과 다름 (11/16 MTS PM 리뷰)
  const mine = items.filter((a) => !a.priceMoveTitle && a.relatedStocks.some((s) => s.code === code));
  const pick =
    mine.find((a) => !a.isDisclosure && a.relatedStocks.some((s) => s.code === code && s.role === 'MAIN')) ||
    mine.find((a) => !a.isDisclosure) ||
    mine[0];
  return pick ? { id: pick.id, title: pick.title } : null;
}
