// 최근 20거래일 종가 추세선. 화면에 보일 때만 부르고(IntersectionObserver), 부르는 동안은 회색 자리, 실패하면 안 그림
// 색: 20거래일 전보다 올랐으면 빨강, 내렸으면 파랑
// wide(화제 종목 카드): 넓고 낮은 칸에 선을 늘리면 납작하게 뭉개져 주식 하는 사람에겐 정보가 없음 (11/18 사용자)
//   → 같은 칸에 20일 미니 캔들(양봉 빨강·음봉 파랑) + 지금 값 점선. 칸 크기는 그대로
//   (거래량 띠도 넣어 봤지만 40px 칸에서 7px 띠는 읽히지 않고 캔들만 납작해져 뺌)
import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { wantSpark } from '../lib/spark';

const W = 72;
const H = 28;

export default function Sparkline({ code, name, disabled = false, wide = false }) {
  const boxRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [entry, setEntry] = useState(null);

  useEffect(() => {
    const el = boxRef.current;
    if (!el || disabled) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '120px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [disabled]);

  // 실패하면 1분 뒤 다시 (화면에 계속 떠 있는 표는 예전엔 다른 화면에 갔다 와야 다시 받았음 — 11/16 코드 리뷰)
  const [retry, setRetry] = useState(0);
  const failed = entry?.status === 'failed';
  useEffect(() => {
    if (!failed) return undefined;
    const t = setTimeout(() => {
      setEntry(null); // 다시 받는 동안은 기다림 상태 → 또 실패하면 failed 가 다시 참이 되어 타이머가 또 걸림
      setRetry((n) => n + 1);
    }, 61_000);
    return () => clearTimeout(t);
  }, [failed, retry]);
  useEffect(() => {
    if (!visible || disabled) return undefined;
    return wantSpark(code, (e) => setEntry({ status: e.status, data: e.data, ohlc: e.ohlc }));
  }, [code, visible, disabled, retry]);

  if (disabled || entry?.status === 'failed') return <span className="spark" aria-hidden="true" ref={boxRef} />;
  // 기다리는 동안은 반짝이는 회색 대신 빈 칸 (11/16 디자이너 리뷰: 표 절반이 반짝여 고장 난 화면처럼 보였음)
  if (!entry?.data) return <span className="spark spark-wait" ref={boxRef} aria-hidden="true" />;

  if (wide && entry.ohlc) return <CandleSpark ref={boxRef} rows={entry.ohlc} name={name} />;

  const vals = entry.data;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const pts = vals.map((v, i) => [(i / (vals.length - 1)) * W, H - 3 - ((v - min) / span) * (H - 6)]);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${W},${H} L0,${H} Z`;
  const first = vals[0];
  const last = vals[vals.length - 1];
  const rate = first ? ((last - first) / first) * 100 : 0;
  const dir = rate > 0 ? 'up' : rate < 0 ? 'down' : 'flat';
  const label = `${name} 최근 ${vals.length}거래일 종가 추이, 처음보다 ${rate > 0 ? '+' : ''}${rate.toFixed(1)}%`;
  return (
    <span className={`spark spark-${dir} ${wide ? 'spark-wide' : ''}`} ref={boxRef} title={label}>
      {/* wide: 카드 너비만큼 늘림 (선 굵기는 그대로) - 화제 종목 카드 */}
      <svg width={wide ? undefined : W} height={wide ? undefined : H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio={wide ? 'none' : undefined} role="img" aria-label={label}>
        <path d={area} className="spark-area" />
        <path d={line} className="spark-line" vectorEffect={wide ? 'non-scaling-stroke' : undefined} />
        {!wide && <circle cx={pts[pts.length - 1][0] - 1.5} cy={pts[pts.length - 1][1]} r="2" className="spark-dot" />}
      </svg>
    </span>
  );
}

const CH = 40; // 칸 높이 (CSS .brief-spark .spark-wide svg 와 같음)

/** 화제 종목 카드: 20일 미니 캔들. 폭은 칸에 맞춰 재고(늘려 그리지 않음 → 선이 뭉개지지 않음) */
const CandleSpark = forwardRef(function CandleSpark({ rows, name }, ref) {
  const wrap = useRef(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return undefined;
    const measure = () => setW(Math.round(el.getBoundingClientRect().width));
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const setRefs = (el) => {
    wrap.current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) ref.current = el;
  };

  const hi = Math.max(...rows.map((r) => r.h));
  const lo = Math.min(...rows.map((r) => r.l));
  const span = hi - lo || 1;
  const top = 2;
  const priceH = CH - 4;
  const y = (p) => top + ((hi - p) / span) * priceH;
  const slot = w / rows.length;
  const body = Math.max(3, Math.min(7, Math.round(slot * 0.4))); // 너무 넓으면 낮은 칸에서 몸통이 대시(-)처럼 보임
  const first = rows[0].c;
  const last = rows[rows.length - 1].c;
  const rate = first ? ((last - first) / first) * 100 : 0;
  const dir = rate > 0 ? 'up' : rate < 0 ? 'down' : 'flat';
  const label = `${name} 최근 ${rows.length}거래일 일봉, 처음보다 ${rate > 0 ? '+' : ''}${rate.toFixed(1)}%, 기간 최고 ${hi.toLocaleString('ko-KR')}원 최저 ${lo.toLocaleString('ko-KR')}원`;

  return (
    <>
    <span className={`spark spark-wide spark-candle spark-${dir}`} ref={setRefs} title={label}>
      {w > 0 && (
        <svg width={w} height={CH} viewBox={`0 0 ${w} ${CH}`} role="img" aria-label={label}>
          {/* 지금 값 높이 (옅은 점선) */}
          <line x1="0" x2={w} y1={Math.round(y(last)) + 0.5} y2={Math.round(y(last)) + 0.5} className="candle-now" />
          {rows.map((r, i) => {
            const cx = Math.round(slot * i + slot / 2) + 0.5;
            const kind = r.c > r.o ? 'up' : r.c < r.o ? 'down' : 'flat';
            const yo = y(r.o);
            const yc = y(r.c);
            const bt = Math.min(yo, yc);
            return (
              <g key={i} className={`candle candle-${kind}${i === rows.length - 1 ? ' candle-last' : ''}`}>
                <line x1={cx} x2={cx} y1={y(r.h)} y2={y(r.l)} className="candle-wick" />
                <rect x={cx - body / 2} y={bt} width={body} height={Math.max(1, Math.abs(yc - yo))} className="candle-body" />
              </g>
            );
          })}
        </svg>
      )}
    </span>
    {/* 기간 등락 (예전 '20일' 글자 자리). 시세 색 */}
    <span className="spark-range num">
      20일 <b className={rate > 0 ? 'up' : rate < 0 ? 'down' : ''}>{`${rate > 0 ? '+' : ''}${rate.toFixed(1)}%`}</b>
    </span>
    </>
  );
});
