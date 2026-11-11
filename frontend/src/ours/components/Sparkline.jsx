// 최근 20거래일 종가 추세선. 화면에 보일 때만 부르고(IntersectionObserver), 부르는 동안은 회색 자리, 실패하면 안 그림
// 색: 20거래일 전보다 올랐으면 빨강, 내렸으면 파랑
import { useEffect, useRef, useState } from 'react';
import { wantSpark } from '../lib/spark';

const W = 72;
const H = 28;

export default function Sparkline({ code, name, disabled = false }) {
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

  useEffect(() => {
    if (!visible || disabled) return undefined;
    return wantSpark(code, (e) => setEntry({ status: e.status, data: e.data }));
  }, [code, visible, disabled]);

  if (disabled || entry?.status === 'failed') return <span className="spark" aria-hidden="true" ref={boxRef} />;
  if (!entry?.data) return <span className="spark skeleton" ref={boxRef} aria-hidden="true" />;

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
    <span className={`spark spark-${dir}`} ref={boxRef} title={label}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        <path d={area} className="spark-area" />
        <path d={line} className="spark-line" />
        <circle cx={pts[pts.length - 1][0] - 1.5} cy={pts[pts.length - 1][1]} r="2" className="spark-dot" />
      </svg>
    </span>
  );
}
