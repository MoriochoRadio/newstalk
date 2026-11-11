// 지우기 전 확인 창. const [confirmUi, ask] = useConfirm(); if (await ask({ title, desc })) …
import { useCallback, useEffect, useRef, useState } from 'react';

export function useConfirm() {
  const [req, setReq] = useState(null); // { title, desc, ok, resolve }
  const okRef = useRef(null);

  const ask = useCallback(
    ({ title, desc, ok = '삭제' }) =>
      new Promise((resolve) => {
        setReq({ title, desc, ok, resolve });
      }),
    []
  );

  const close = (answer) => {
    req?.resolve(answer);
    setReq(null);
  };

  useEffect(() => {
    if (!req) return undefined;
    const prev = document.activeElement;
    okRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') {
        req.resolve(false);
        setReq(null);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [req]);

  const ui = req ? (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close(false)}>
      <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-desc">
        <h2 className="modal-title" id="confirm-title">
          {req.title}
        </h2>
        {req.desc && (
          <p className="modal-desc" id="confirm-desc" style={{ marginTop: 8, marginBottom: 0 }}>
            {req.desc}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={() => close(false)}>
            취소
          </button>
          <button type="button" className="btn btn-primary" ref={okRef} onClick={() => close(true)} style={{ background: 'var(--danger-solid)' }}>
            {req.ok}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return [ui, ask];
}
