// 오늘 시장 단어 구름 (11/16 저녁 사용자: "기사 제목을 일일이 안 읽어도 한눈에 오늘 장을 떠먹여 주는")
// - 글자 크기 = 그 말이 나온 소식 수 (같은 내용 기사 묶음은 한 번), 색 = 그 소식들이 주로 좋은 소식(초록)·나쁜 소식(주황)·섞임(본문색)
// - 자리: 가운데부터 나선으로 돌며 겹치지 않는 곳에 (wordcloud 기본 방식). 큰 말이 가운데
// - 움직임: 처음에 하나씩 떠오르고, 그 뒤 아주 천천히 둥실 (움직임 줄이기 설정이면 멈춤)
// - 누르면 오늘 그 말이 들어간 기사 검색
import { useMemo, useRef, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { iGa } from '../lib/josa';

const FONT = "'Pretendard Variable', Pretendard, system-ui, sans-serif";

function useSize(ref) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    setW(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

let ctx = null;
function textWidth(text, size, weight) {
  if (!ctx) ctx = document.createElement('canvas').getContext('2d');
  ctx.font = `${weight} ${size}px ${FONT}`;
  return ctx.measureText(text).width;
}

/** 나선 배치: 큰 말부터, 가운데에서 바깥으로 돌며 다른 말·테두리와 안 겹치는 첫 자리 */
function layout(words, width, height) {
  const placed = [];
  const cx = width / 2;
  const cy = height / 2;
  const pad = 6;
  const hit = (r) => placed.some((p) => r.x < p.x + p.w + pad && r.x + r.w + pad > p.x && r.y < p.y + p.h + pad && r.y + r.h + pad > p.y);
  for (const w of words) {
    const tw = textWidth(w.term, w.size, w.weight);
    const th = w.size * 1.15;
    let ok = null;
    for (let t = 0; t < 900; t += 1) {
      const a = t * 0.35;
      const rad = 4 * a;
      // 가로로 넓은 상자라 가로를 더 넓게 돔
      const x = cx + rad * Math.cos(a) * 1.6 - tw / 2;
      const y = cy + rad * Math.sin(a) - th / 2;
      const r = { x, y, w: tw, h: th };
      if (x < 4 || y < 4 || x + tw > width - 4 || y + th > height - 4) continue;
      if (!hit(r)) {
        ok = r;
        break;
      }
    }
    if (ok) placed.push({ ...w, ...ok });
  }
  return placed;
}

export default function WordCloud({ terms, height = 340 }) {
  const boxRef = useRef(null);
  const width = useSize(boxRef);
  const max = Math.max(1, ...terms.map((t) => t.count));
  const min = Math.min(...terms.map((t) => t.count), max);
  const small = width && width < 520;
  const words = useMemo(() => {
    if (!width) return [];
    const lo = small ? 14 : 16;
    const hi = small ? 40 : 60;
    const list = terms.slice(0, small ? 22 : 40).map((t) => {
      const k = max === min ? 1 : (Math.sqrt(t.count) - Math.sqrt(min)) / (Math.sqrt(max) - Math.sqrt(min));
      const size = Math.round(lo + k * (hi - lo));
      // 좋은·나쁜이 한쪽으로 뚜렷할 때만 색 (판단 기사 2건 이상, 한쪽이 1.5배 넘게)
      const tone = t.pos + t.neg >= 2 && t.pos > t.neg * 1.5 ? 'pos' : t.pos + t.neg >= 2 && t.neg > t.pos * 1.5 ? 'neg' : 'none';
      return { ...t, size, weight: size >= 34 ? 800 : 700, tone };
    });
    return layout(list, width, height);
  }, [terms, width, height, max, min, small]);

  return (
    <div className="word-cloud" ref={boxRef} style={{ height }}>
      <ul aria-label="오늘 기사에 많이 나온 말">
        {words.map((w, i) => (
          <li
            key={w.term}
            className={`wc-word wc-${w.tone}`}
            style={{
              left: w.x,
              top: w.y,
              fontSize: w.size,
              fontWeight: w.weight,
              '--wc-delay': `${Math.min(i * 45, 1200)}ms`,
              '--wc-float': `${5 + (i % 5)}s`,
              '--wc-float-delay': `${(i % 7) * -0.9}s`,
            }}
          >
            <Link to={`/search?q=${encodeURIComponent(w.term)}&period=today`} title={`오늘 '${w.term}'${iGa(w.term)} 나온 소식 ${w.count}개 — 눌러서 기사 보기`}>
              {w.term}
              <span className="sr-only"> 소식 {w.count}개</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
