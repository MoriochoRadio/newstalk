// 기사 → "소식" 묶기: 같은 소식(서버 sameNewsCount·firstReportPress)으로 묶인 기사는 한 줄로 접고 첫 보도를 대표로
// 받은 목록(한 페이지) 안에서만 묶음. 묶음 크기 숫자는 서버 값(sameNewsCount)을 그대로 씀
// 묶는 기준: 주인공 종목(없으면 첫 종목) + 묶음 크기 + 첫 보도 언론사가 같고 24시간 안 (같은 소식 목록과 같은 기준)

const DAY_MS = 24 * 3600 * 1000;

function storyKey(a) {
  const main = a.relatedStocks.find((s) => s.role === 'MAIN') || a.relatedStocks[0];
  if (!main || !(main.sameNewsCount >= 2)) return null;
  return `${main.code}:${main.sameNewsCount}:${main.firstReportPress}`;
}

/** [{ lead, others: [글], size }] 순서는 목록에서 처음 나온 자리 */
export function groupStories(articles) {
  const out = [];
  const open = new Map(); // key → story
  for (const a of articles || []) {
    const key = storyKey(a);
    const prev = key ? open.get(key) : null;
    const t = new Date(a.publishedAtIso || 0).getTime();
    if (prev && Math.abs(new Date(prev.lead.publishedAtIso || 0).getTime() - t) <= DAY_MS) {
      // 첫 보도가 나중에 나오면 대표를 바꿈
      if (a.firstReport && !prev.lead.firstReport) {
        prev.others.unshift(prev.lead);
        prev.lead = a;
      } else {
        prev.others.push(a);
      }
      continue;
    }
    const story = { lead: a, others: [], size: a.sameNewsCount || 1 };
    if (key) open.set(key, story);
    out.push(story);
  }
  return out;
}
