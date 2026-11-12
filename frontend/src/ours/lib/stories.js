// 기사 → "소식" 묶기: 같은 소식(서버 sameNewsCount·firstReportPress)으로 묶인 기사는 한 줄로 접고 첫 보도를 대표로
// 받은 목록(한 페이지) 안에서만 묶음.
// 숫자 (11/12 고침): size = 받은 목록 안의 기사 수(오늘 피드면 '오늘 기사 수'), pressCount = 그중 언론사 수,
//   total = 서버 sameNewsCount(어제 등 이전 보도까지 포함한 묶음 전체). 예전엔 total 을 "언론 n곳"으로 보여 줘서
//   삼양식품 베트남 공장(어제 6건 + 오늘 5건, 언론 5곳)이 "언론 11곳"으로 나왔음 — 기사 수 ≠ 언론 수, 오늘 ≠ 전체
// 묶는 기준: 주인공 종목(없으면 첫 종목) + 묶음 크기 + 첫 보도 언론사가 같고 24시간 안 (같은 소식 목록과 같은 기준)

const DAY_MS = 24 * 3600 * 1000;

function storyKey(a) {
  const main = a.relatedStocks.find((s) => s.role === 'MAIN') || a.relatedStocks[0];
  if (!main || !(main.sameNewsCount >= 2)) return null;
  return `${main.code}:${main.sameNewsCount}:${main.firstReportPress}`;
}

/** [{ lead, others: [글], size(받은 목록 안 기사 수), pressCount, total(이전 보도 포함) }] 순서는 목록에서 처음 나온 자리 */
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
    const story = { lead: a, others: [], size: 1, total: a.sameNewsCount || 1 };
    if (key) open.set(key, story);
    out.push(story);
  }
  for (const st of out) {
    const all = [st.lead, ...st.others];
    st.size = all.length;
    st.pressCount = new Set(all.map((x) => x.press)).size;
  }
  return out;
}
