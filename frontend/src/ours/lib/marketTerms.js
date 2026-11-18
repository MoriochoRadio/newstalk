// 오늘 시장 분위기 단어 (홈 '단어 구름', 11/16 저녁 사용자: "관련 없는 글자 말고, 오늘 장을 단어·용어로 한 번에")
// AI 가 기사별 키워드를 아직 저장하지 않아(article.keywords 비어 있음) 화면에서 셈.
// 형태소 분석 없이 제목·요약에서 낱말을 자르면 '체결했다', '삼성전자가' 같은 조각이 섞이므로
//  ① 시장 용어 사전(아래)에 있는 말 + ② 영문 약어(HBM·ESS·IPO …)만 셈 → 관련 없는 글자가 나오지 않음
// 같은 소식(같은 내용 기사 묶음)은 한 번만 셈: 받아쓰기 기사가 숫자를 부풀리지 않게
// 회사 이름은 뺌: 종목은 다른 칸(기사 많은 종목·시장 지도)이 보여 주고, 여기는 '무슨 일'이 주인공

// 표시 이름: 찾을 낱말들 (첫 낱말이 화면에 나옴). 같은 뜻은 한 줄로 묶음
const TERMS = [
  ['실적', '실적'], ['영업이익', '영업이익'], ['흑자전환', '흑자전환', '흑자 전환'], ['적자', '적자'], ['매출', '매출'],
  ['어닝서프라이즈', '어닝서프라이즈', '어닝 서프라이즈', '깜짝 실적'], ['수주', '수주'], ['공급계약', '공급계약', '공급 계약', '단일판매'],
  ['반도체', '반도체'], ['메모리', '메모리'], ['데이터센터', '데이터센터'], ['인공지능', '인공지능', 'AI'],
  ['배터리', '배터리', '2차전지', '이차전지'], ['전기차', '전기차'], ['자율주행', '자율주행'], ['로봇', '로봇', '휴머노이드'],
  ['우주', '우주', '위성', '발사체'], ['방산', '방산', '방위산업'], ['조선', '조선', '선박'], ['원전', '원전', '원자력', 'SMR'],
  ['바이오', '바이오'], ['신약', '신약'], ['임상', '임상'], ['게임', '게임'], ['콘텐츠', '콘텐츠', '엔터'], ['화장품', '화장품', 'K뷰티'],
  ['금리', '금리'], ['환율', '환율', '원·달러', '원달러'], ['유가', '유가'], ['관세', '관세'], ['수출', '수출'], ['물가', '물가'],
  ['외국인', '외국인'], ['기관', '기관'], ['개인', '개인 투자자', '개미'], ['순매수', '순매수'], ['순매도', '순매도'], ['공매도', '공매도'],
  ['급등', '급등'], ['급락', '급락'], ['상승', '상승'], ['하락', '하락'], ['반등', '반등'], ['신고가', '신고가'], ['상한가', '상한가'], ['하한가', '하한가'],
  ['목표주가', '목표주가', '목표가'], ['투자의견', '투자의견'], ['자사주', '자사주', '자기주식'], ['배당', '배당'],
  ['유상증자', '유상증자'], ['무상증자', '무상증자'], ['인수', '인수'], ['합병', '합병'], ['상장', '상장', '공모', 'IPO'],
  ['투자', '투자'], ['증설', '증설'], ['공장', '공장'], ['협력', '협력', '협약', 'MOU', '업무협약'], ['출시', '출시', '신제품'],
  ['소송', '소송'], ['제재', '제재', '과징금'], ['규제', '규제'], ['정책', '정책', '정부'], ['밸류업', '밸류업'],
  ['코스피', '코스피'], ['코스닥', '코스닥'], ['엔비디아', '엔비디아'], ['트럼프', '트럼프'], ['중국', '중국'], ['미국', '미국'],
  ['ESG', 'ESG'], ['연금', '연금', '퇴직연금', 'IRP'], ['금융', '금융'], ['부동산', '부동산', '재건축'], ['보험', '보험'],
];
// 시장 용어인 영문 약어 (이 목록에 있는 것만 단어 구름에 나옴)
const ACRONYMS = new Set(['HBM', 'ESS', 'LFP', 'SMR', 'ETF', 'EV', 'OLED', 'LNG', 'GPU', 'CXL', 'DRAM', 'NAND', 'CDMO', 'ADC', 'PER', 'PBR', 'ROE', 'FOMC', 'CPI', 'GDP', 'MSCI', 'PCB', 'MLCC', 'UAM', 'IRA', 'CHIPS', 'STO', 'VC', 'PEF', 'M&A']);
const KNOWN = new Set(TERMS.flatMap((t) => t.slice(1)));

/** stories: groupStories 결과. 돌려줌: [{ term, count(소식 수), pos, neg, ids:[대표 글 id] }] 많이 나온 순 */
export function marketTerms(stories, limit = 40) {
  const map = new Map();
  const add = (term, st, tone) => {
    const e = map.get(term) || { term, count: 0, pos: 0, neg: 0, ids: [] };
    e.count += 1;
    if (tone === 'POSITIVE') e.pos += 1;
    if (tone === 'NEGATIVE') e.neg += 1;
    if (e.ids.length < 3) e.ids.push(st.lead.id);
    map.set(term, e);
  };
  for (const st of stories || []) {
    const all = [st.lead, ...(st.others || [])];
    const text = all.map((a) => `${a.title} ${(a.summary || []).join(' ')}`).join(' ');
    const main = st.lead.relatedStocks?.find((s) => s.role === 'MAIN') || st.lead.relatedStocks?.[0];
    // 시세 기사는 좋은·나쁜 판단을 셈에 넣지 않음 (목록 배지와 같은 규칙)
    const tone = st.lead.priceMoveTitle ? null : main?.sentiment;
    const names = new Set(all.flatMap((a) => (a.relatedStocks || []).map((s) => s.name)));
    const seen = new Set();
    for (const [label, ...words] of TERMS) {
      if (words.some((w) => text.includes(w))) seen.add(label);
    }
    // 영문 약어는 정한 목록만 (자유롭게 뽑으면 IBK·KCGS·NOW 처럼 회사·기관 이름이 섞였음 — 11/16 화면 확인)
    for (const m of text.matchAll(/(?<![A-Za-z])[A-Z][A-Z0-9]{1,5}(?![A-Za-z])/g)) {
      const w = m[0];
      if (!ACRONYMS.has(w) || KNOWN.has(w) || [...names].some((n) => n.includes(w))) continue;
      seen.add(w);
    }
    seen.forEach((t) => add(t, st, tone));
  }
  return [...map.values()]
    .filter((e) => e.count >= 2) // 한 소식에만 나온 말은 '오늘 분위기'가 아님
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
