// 작은 화면 조각: 스켈레톤·빈 화면·오류·페이지 번호·묶음 선택·등락 표시
import { AlertCircle, ChevronLeft, ChevronRight, Inbox, RotateCw } from 'lucide-react';
import { dirClass, fmtPrice, fmtRate } from '../lib/format';
import { errorText } from '../lib/errors';

export function SkeletonRows({ rows = 4, compact = false }) {
  return (
    <div role="status">
      <span className="sr-only">불러오는 중…</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} style={{ padding: compact ? '10px 0' : '14px 0' }}>
          <div className="skeleton sk-title" style={{ width: `${72 - (i % 3) * 12}%` }} />
          <div className="skeleton sk-line" style={{ width: `${40 + (i % 2) * 18}%` }} />
        </div>
      ))}
    </div>
  );
}

export function Empty({ icon: Icon = Inbox, title, desc, action }) {
  return (
    <div className="empty">
      <div className="empty-icon" aria-hidden="true">
        <Icon className="icon" />
      </div>
      <p className="empty-title">{title}</p>
      {desc && <p className="empty-desc">{desc}</p>}
      {action}
    </div>
  );
}

export function ErrorBox({ error, onRetry, text }) {
  return (
    <div className="inline-error" role="alert">
      <AlertCircle className="icon-sm" aria-hidden="true" />
      <span style={{ flex: 1 }}>{text || errorText(error)}</span>
      {onRetry && (
        <button type="button" className="btn btn-sm btn-ghost" onClick={onRetry}>
          <RotateCw className="icon-sm" aria-hidden="true" />
          다시 시도
        </button>
      )}
    </div>
  );
}

/** 페이지 번호. total 은 서버 totalCount */
export function Pager({ page, size, total, onChange }) {
  const last = Math.max(1, Math.ceil((total || 0) / size));
  if (last <= 1) return null;
  const span = 2;
  let from = Math.max(1, page - span);
  let to = Math.min(last, page + span);
  if (to - from < span * 2) {
    if (from === 1) to = Math.min(last, from + span * 2);
    else if (to === last) from = Math.max(1, to - span * 2);
  }
  const nums = [];
  for (let i = from; i <= to; i += 1) nums.push(i);
  return (
    <nav aria-label="페이지">
      <div className="pager">
        <button type="button" onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="이전 페이지">
          <ChevronLeft className="icon-sm" aria-hidden="true" />
        </button>
        {from > 1 && (
          <>
            <button type="button" onClick={() => onChange(1)}>
              1
            </button>
            {from > 2 && <span className="muted">…</span>}
          </>
        )}
        {nums.map((n) => (
          <button key={n} type="button" onClick={() => onChange(n)} aria-current={n === page ? 'page' : undefined}>
            {n}
          </button>
        ))}
        {to < last && (
          <>
            {to < last - 1 && <span className="muted">…</span>}
            <button type="button" onClick={() => onChange(last)}>
              {last.toLocaleString('ko-KR')}
            </button>
          </>
        )}
        <button type="button" onClick={() => onChange(page + 1)} disabled={page >= last} aria-label="다음 페이지">
          <ChevronRight className="icon-sm" aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}

/** 알약 모양 묶음 선택. options: [{ key, label }] */
export function Segmented({ options, value, onChange, label, size }) {
  return (
    <div className={`segmented ${size === 'sm' ? 'sm' : ''}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.key} type="button" aria-pressed={value === o.key} onClick={() => onChange(o.key)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** 현재가 + 등락률 (상승 빨강·하락 파랑). quote 가 없으면 "–" */
export function PriceCell({ quote, stacked = true }) {
  if (!quote) {
    return (
      <span className="muted num" title="시세를 받지 못했어요">
        –
      </span>
    );
  }
  const cls = dirClass(quote.changeRate);
  if (!stacked) {
    return (
      <span className="num" style={{ whiteSpace: 'nowrap' }}>
        <b>{fmtPrice(quote.price)}</b> <span className={`change ${cls}`}>{fmtRate(quote.changeRate)}</span>
      </span>
    );
  }
  return (
    <span className="stock-row-price">
      <span className="p" style={{ display: 'block' }}>
        {fmtPrice(quote.price)}원
      </span>
      <span className={`r ${cls}`}>{fmtRate(quote.changeRate)}</span>
    </span>
  );
}
