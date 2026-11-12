// 지우기 전 확인 창. const [confirmUi, ask] = useConfirm(); if (await ask({ title, desc })) …
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusTrap } from '../lib/focusTrap';

export function useConfirm() {
  const [req, setReq] = useState(null); // { title, desc, ok, resolve }
  const cancelRef = useRef(null);
  const boxRef = useRef(null);

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

  // 처음 포커스는 '취소' (지우는 창에서 Enter 한 번에 지워지지 않게), 닫으면 누른 버튼으로 되돌림
  useEffect(() => {
    if (!req) return undefined;
    const prev = document.activeElement;
    cancelRef.current?.focus();
    return () => prev?.focus?.();
  }, [req]);
  const onEscape = useCallback(() => {
    setReq((r) => {
      r?.resolve(false);
      return null;
    });
  }, []);
  useFocusTrap(boxRef, Boolean(req), onEscape);

  const ui = req ? (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close(false)}>
      <div className="modal" ref={boxRef} role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby={req.desc ? 'confirm-desc' : undefined}>
        <h2 className="modal-title" id="confirm-title">
          {req.title}
        </h2>
        {req.desc && (
          <p className="modal-desc" id="confirm-desc" style={{ marginTop: 8, marginBottom: 0 }}>
            {req.desc}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" ref={cancelRef} onClick={() => close(false)}>
            취소
          </button>
          <button type="button" className="btn btn-primary" onClick={() => close(true)} style={{ background: 'var(--danger-solid)' }}>
            {req.ok}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return [ui, ask];
}
