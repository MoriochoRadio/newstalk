// 좋은·나쁜 소식 한눈에 (11/12 사용자: "딱 봤을 때 안 좋은 기사네? 좋은 기사네? 를 생각하지 않아도 떠먹여 주듯이")
// 두 가지를 나눠서 보여 줌 — 근거의 종류가 다르기 때문
// 1) TitleText: 제목은 그대로 (↑↓ 에 색을 입히던 시도는 값이 떨어진 것처럼 읽혀서 뺌)
// 2) Tone: AI 가 기사 내용이 "그 회사에" 좋은 소식인지 나쁜 소식인지 나눈 것 → 회사 이름을 붙이고, 중립·판단 안 함은 표시 안 함
//    단정처럼 보이지 않게: 화살표 대신 점(●), "오른다/내린다" 대신 "좋은/나쁜 소식", 마우스를 올리면 설명
//    색: 좋은 소식 초록·나쁜 소식 주황 — 시세의 빨강(상승)·파랑(하락)과 일부러 다르게 (빨강·파랑이면 주가가 움직인 것으로 읽힘, 11/12)
//    색만으로 전달하지 않게 글자로도 씀 (WCAG 1.4.1)
// 보이는 방식: 링 + 글자로 고정 (11/12 밤 사용자 선택. 작은 점·물들임·끔과 비교함)
// 3) ToneRing (11/12 밤, 사용자: "좋은·나쁜 내용 함께에 색이 섞인 동그라미가 맘에 든다, 더 크게 시각화"):
//    unslop 스킬의 '시그니처' — 이 서비스에만 있는 작은 표시 하나를 정해 같은 뜻으로만 씀.
//    링 = 이 기사·소식·종목의 좋은·중립·나쁜 판단 비율 (초록·회색·주황, 조각 사이 2px 틈 = dataviz 스킬)

export const TONE_TIP = 'AI가 기사·공시 내용을 읽고 이 회사에 좋은 소식인지 나쁜 소식인지 나눈 거예요. 주가가 오르거나 내린다는 예측이 아니에요.';

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
  // '함께 언급'만 된 종목에는 목록에서 좋은·나쁜 표시를 안 붙임 (11/16 리뷰: 은행원 수기 글이 SK하이닉스에 '나쁜 소식'으로 보임). 글 화면 카드에는 그대로
  if (s && s.role !== 'MAIN') return null;
  const v = s?.sentiment || null;
  if (v !== 'POSITIVE' && v !== 'NEGATIVE') return null;
  const kind = v === 'POSITIVE' ? 'pos' : 'neg';
  const dir = titleDir(article.title);
  const conflict = (dir === 'down' && kind === 'pos') || (dir === 'up' && kind === 'neg');
  return { kind: conflict ? 'mixed' : kind, name: s.name };
}

/** 같은 소식 묶음: 링·숫자와 같은 말이 되도록 판단 수로 정함 (좋은·나쁜 둘 다 있으면 mixed)
 *  11/12 밤: 제목 방향(↓)으로 mixed 를 덧씌웠더니 "좋은·나쁜 내용 함께"인데 숫자는 "좋은 1 · 나쁜 0"이라 서로 어긋남 → 숫자 기준 */
export function toneOfStory(story) {
  const c = storyCounts(story);
  if (!c.pos && !c.neg) return null;
  const main = story.lead.relatedStocks.find((s) => s.role === 'MAIN') || story.lead.relatedStocks[0];
  return { kind: c.pos && c.neg ? 'mixed' : c.pos ? 'pos' : 'neg', name: main?.name || '' };
}

/** 좋은·중립·나쁜 판단 수를 링으로. 한 색이면 꽉 찬 링, 섞이면 조각. 합이 0 이면 그리지 않음 */
export function ToneRing({ pos = 0, neu = 0, neg = 0, size = 16, className = '' }) {
  const total = pos + neu + neg;
  if (!total) return null;
  const w = Math.max(2.5, size / 5);
  const r = (size - w) / 2;
  const c = 2 * Math.PI * r;
  const parts = [
    ['pos', pos],
    ['neu', neu],
    ['neg', neg],
  ].filter(([, n]) => n > 0);
  const gap = parts.length > 1 ? Math.min(2, c / 20) : 0;
  let at = 0;
  return (
    <svg className={`tone-ring ${className}`} width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      {parts.map(([k, n]) => {
        const len = (n / total) * c;
        const el = (
          <circle
            key={k}
            className={`ring-${k}`}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={w}
            strokeDasharray={`${Math.max(0.01, len - gap)} ${c}`}
            strokeDashoffset={-at}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        );
        at += len;
        return el;
      })}
    </svg>
  );
}

/** 판단 값 → 링 재료 */
export function countsOf(sentiments) {
  const c = { pos: 0, neu: 0, neg: 0 };
  for (const v of sentiments) {
    if (v === 'POSITIVE') c.pos += 1;
    else if (v === 'NEGATIVE') c.neg += 1;
    else if (v === 'NEUTRAL') c.neu += 1;
  }
  return c;
}

/** 같은 소식 묶음의 판단 수 (주인공 종목 기준, 제목만 확인한 기사 제외) */
export function storyCounts(story) {
  const all = [story.lead, ...(story.others || [])].filter((x) => !x.titleOnly && !x.disclosurePending);
  return countsOf(all.map((x) => (x.relatedStocks.find((s) => s.role === 'MAIN') || x.relatedStocks[0])?.sentiment));
}

const TONE_TEXT = { pos: '좋은 소식', neg: '나쁜 소식', mixed: '좋은·나쁜 내용 함께' };

/** 여러 기사를 모았을 때 한마디 (홈 카드·종목 화면 같은 기준). 11/13 사용자 눈으로: 좋은 1 · 중립 3 · 나쁜 0 인데
 *  '좋은 소식이 더 많아요'라고 나와 과장됨 → 중립이 좋은+나쁜보다 많으면 '대부분 중립' */
export function leanOf(pos = 0, neu = 0, neg = 0) {
  if (neu > pos + neg) return { kind: 'neutral', text: '대부분 판단 없음' };
  if (pos > neg) return { kind: 'pos', text: '좋은 소식이 더 많아요' };
  if (neg > pos) return { kind: 'neg', text: '나쁜 소식이 더 많아요' };
  return { kind: 'mixed', text: '좋은·나쁜 소식이 비슷해요' };
}

/** "AI가 읽은 기사 n건: 모두 나쁜 소식" / "…: 좋은 2 · 나쁜 1 · 중립 2" — 세 수의 합이 n 이 되게 (11/13 사용자 눈으로 써 보기:
 *  'AI가 판단한 2건 중 좋은 0 · 나쁜 2' 바로 밑에 '오늘 기사 4건'이 있어 2와 4가 헷갈리고, 중립이 빠져 합이 안 맞았음) */
export function toneCountText(pos = 0, neu = 0, neg = 0) {
  const n = pos + neu + neg;
  if (!n) return '';
  if (pos === n) return `AI가 읽은 기사 ${n}건: 모두 좋은 소식`;
  if (neg === n) return `AI가 읽은 기사 ${n}건: 모두 나쁜 소식`;
  return `AI가 읽은 기사 ${n}건: 좋은 ${pos} · 나쁜 ${neg}${neu ? ` · 판단 없음 ${neu}` : ''}`;
}

export default function Tone({ article, focusCode, tone, withName = true, counts }) {
  const t = tone !== undefined ? tone : toneOf(article, focusCode);
  if (!t) return null;
  // 링 재료: 넘겨준 수(같은 소식 묶음)가 있으면 그것, 없으면 이 글 하나 (엇갈림이면 반반)
  const ring = counts || (t.kind === 'pos' ? { pos: 1 } : t.kind === 'neg' ? { neg: 1 } : { pos: 1, neg: 1 });
  const n = counts ? counts.pos + counts.neu + counts.neg : 0;
  return (
    <span className={`tone tone-${t.kind}`} title={TONE_TIP}>
      <ToneRing {...ring} size={16} />
      <i aria-hidden="true" />
      <span>
        {withName ? `${t.name}에 ` : ''}
        {TONE_TEXT[t.kind]}
      </span>
      {n >= 2 && (
        <span className="tone-count num">{toneCountText(counts.pos, counts.neu, counts.neg)}</span>
      )}
    </span>
  );
}

/** 줄·카드에 붙이는 클래스 (물들임 시안용) */
export const toneRowClass = (t) => (t && t.kind !== 'mixed' ? `tone-row-${t.kind}` : '');
