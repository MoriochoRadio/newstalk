// 좋은·나쁜 소식 한눈에 (11/12 사용자: "딱 봤을 때 안 좋은 기사네? 좋은 기사네? 를 생각하지 않아도 떠먹여 주듯이")
// 두 가지를 나눠서 보여 줌 — 근거의 종류가 다르기 때문
// 1) TitleText: 제목은 그대로 (↑↓ 에 색을 입히던 시도는 값이 떨어진 것처럼 읽혀서 뺌)
// 2) Tone: AI 가 기사 내용이 "그 회사에" 좋은 소식인지 나쁜 소식인지 나눈 것 → 회사 이름을 붙이고, 중립·판단 안 함은 표시 안 함
//    단정처럼 보이지 않게: 화살표 대신 점(●), "오른다/내린다" 대신 "좋은/나쁜 소식", 마우스를 올리면 설명
//    색: 좋은 소식 초록·나쁜 소식 주황 — 시세의 빨강(상승)·파랑(하락)과 일부러 다르게 (빨강·파랑이면 주가가 움직인 것으로 읽힘, 11/12)
//    색만으로 전달하지 않게 글자로도 씀 (WCAG 1.4.1)
// 보이는 방식은 시안 비교용으로 <html data-tone="label|tint|off"> 에 따라 바뀜 (기본 label)

export const TONE_TIP = 'AI가 기사 내용을 읽고 이 회사에 좋은 소식인지 나쁜 소식인지 나눈 거예요. 주가가 오르거나 내린다는 예측이 아니에요.';

/** 제목 그대로 (11/12 저녁: ↑↓ 숫자에 빨강·파랑을 입혔더니 "주식이 떨어진 것처럼 느껴진다" → 색 없음.
 *  자리만 남겨 둠: 나중에 제목 강조를 다시 시험할 때 이곳만 바꾸면 됨) */
export function TitleText({ text }) {
  return String(text || '');
}

/** 제목에 쓰인 방향: 'up' | 'down' | null (둘 다 있거나 없으면 null) */
export function titleDir(title) {
  const t = String(title || '');
  const up = /[↑▲△]/.test(t);
  const down = /[↓▼▽]/.test(t);
  return up === down ? null : up ? 'up' : 'down';
}

/**
 * 이 글이 이 종목에 어떤 소식인가: { kind: 'pos'|'neg'|'mixed', name } 또는 null(중립·판단 안 함)
 * 보는 종목(focusCode)이 있으면 그 종목, 없으면 주인공 종목
 * mixed: 제목의 방향(↑↓)과 AI 판단이 반대일 때 (11/12 발견: "영업이익 20.9%↓" 제목에 AI 는 "좋은 소식" — AI 팩토리 계약 때문.
 *   둘 다 기사에 있는 내용이라 한쪽만 보여 주면 틀려 보임 → "좋은·나쁜 내용 함께")
 */
export function toneOf(article, focusCode) {
  if (!article || article.titleOnly || article.disclosurePending || article.sourceType === 'SNS') return null;
  const stocks = article.relatedStocks || [];
  const s = (focusCode && stocks.find((x) => x.code === focusCode)) || stocks.find((x) => x.role === 'MAIN') || stocks[0];
  const v = s?.sentiment || null;
  if (v !== 'POSITIVE' && v !== 'NEGATIVE') return null;
  const kind = v === 'POSITIVE' ? 'pos' : 'neg';
  const dir = titleDir(article.title);
  const conflict = (dir === 'down' && kind === 'pos') || (dir === 'up' && kind === 'neg');
  return { kind: conflict ? 'mixed' : kind, name: s.name };
}

/** 같은 소식 묶음: 판단한 기사들이 모두 같으면 그것, 엇갈리면 mixed (대표 제목의 방향과도 맞춰 봄) */
export function toneOfStory(story) {
  const all = [story.lead, ...(story.others || [])];
  const tones = all.map((x) => toneOf(x)).filter(Boolean);
  if (!tones.length) return null;
  const kinds = new Set(tones.map((t) => t.kind));
  let kind = kinds.size === 1 ? tones[0].kind : 'mixed';
  const dir = titleDir(story.lead.title);
  if ((dir === 'down' && kind === 'pos') || (dir === 'up' && kind === 'neg')) kind = 'mixed';
  return { kind, name: tones[0].name };
}

const TONE_TEXT = { pos: '좋은 소식', neg: '나쁜 소식', mixed: '좋은·나쁜 내용 함께' };

export default function Tone({ article, focusCode, tone, withName = true }) {
  const t = tone !== undefined ? tone : toneOf(article, focusCode);
  if (!t) return null;
  return (
    <span className={`tone tone-${t.kind}`} title={TONE_TIP}>
      <i aria-hidden="true" />
      {withName ? `${t.name}에 ` : ''}
      {TONE_TEXT[t.kind]}
    </span>
  );
}

/** 줄·카드에 붙이는 클래스 (물들임 시안용) */
export const toneRowClass = (t) => (t && t.kind !== 'mixed' ? `tone-row-${t.kind}` : '');
