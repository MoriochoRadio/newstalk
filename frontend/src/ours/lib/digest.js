// 종목 하나의 오늘 소식 정리 (브리핑 카드 재료). 화면이 이미 받은 "오늘 글 전부"(todayFeed)로 계산 — 요청을 더 하지 않음
// - 기사 수·언론사 수: 공시를 뺀 뉴스 기준, 언론사는 이름이 다른 곳 수
// - 소식 종류 태그: 공시 유형(서버 disclosureType) + 기사 제목·요약에 나온 낱말 묶음(아래 TOPICS). AI 판단이 아니라 글자 맞추기라
//   "많이 나온 주제" 정도의 뜻만 가짐 (화면에도 숫자와 함께 사실로만 보여 줌)
// - 대체 문장: AI 종합 요약이 없을 때 그 종목이 주인공인 최신 뉴스 제목 1~2개 (같은 소식은 한 번)

export const TOPICS = [
  { label: '실적', words: ['실적', '영업이익', '매출', '순이익', '어닝'] },
  { label: '수주·계약', words: ['수주', '공급계약', '단일판매', '납품', '계약 체결'] },
  { label: '배당', words: ['배당'] },
  { label: '자사주', words: ['자사주', '자기주식'] },
  { label: '증자', words: ['유상증자', '무상증자'] },
  { label: '인수·합병', words: ['인수', '합병', 'M&A'] },
  { label: '신약·임상', words: ['신약', '임상', '품목허가'] },
  { label: '소송·제재', words: ['소송', '제재', '과징금', '압수수색', '검찰'] },
  { label: '투자·증설', words: ['증설', '설비투자', '신규 투자', '공장'] },
  { label: '증권사 의견', words: ['목표가', '목표주가', '투자의견'] },
  { label: '외국인·기관', words: ['외국인', '기관', '순매수', '순매도'] },
  { label: '신제품', words: ['출시', '신제품', '공개'] },
  { label: '주가 급변', words: ['급등', '급락', '상한가', '하한가', '신고가', '신저가'] },
];

const sameStory = (a, code) => {
  const s = a.relatedStocks.find((r) => r.code === code);
  return s && s.sameNewsCount >= 2 ? `${s.sameNewsCount}:${s.firstReportPress}` : `id:${a.id}`;
};

export function stockDigest(items, code) {
  const mine = (items || []).filter((a) => a.relatedStocks.some((s) => s.code === code));
  const news = mine.filter((a) => !a.isDisclosure);
  const disclosures = mine.filter((a) => a.isDisclosure);
  const press = new Set(news.map((a) => a.press).filter(Boolean));

  const topicCount = new Map();
  for (const a of news) {
    const text = `${a.title} ${a.summary.join(' ')}`;
    for (const t of TOPICS) {
      if (t.words.some((w) => text.includes(w))) topicCount.set(t.label, (topicCount.get(t.label) || 0) + 1);
    }
  }
  const topics = [...topicCount.entries()]
    .sort((x, y) => y[1] - x[1])
    .slice(0, 3)
    .map(([label, count]) => ({ label, count }));
  const disclosureTypes = [...new Set(disclosures.map((a) => a.disclosureType).filter(Boolean))].slice(0, 2);

  const seen = new Set();
  const headlines = [];
  for (const a of news) {
    if (!a.relatedStocks.some((s) => s.code === code && s.role === 'MAIN')) continue;
    const k = sameStory(a, code);
    if (seen.has(k)) continue;
    seen.add(k);
    headlines.push({ id: a.id, title: a.title, press: a.press });
    if (headlines.length >= 2) break;
  }

  return {
    newsCount: news.length,
    disclosureCount: disclosures.length,
    pressCount: press.size,
    topics,
    disclosureTypes,
    headlines,
  };
}
