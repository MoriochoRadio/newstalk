// 창(대화 상자) 안에서만 Tab 이 돌게 + Esc 로 닫기 (fixing-accessibility: 모달은 포커스를 가두고, 닫으면 원래 자리로)
// AuthModal 의 가두기와 같은 방식을 확인 창·휴대폰 검색 창이 함께 씀 (11/12 코드 점검)
import { useEffect } from 'react';

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

export function useFocusTrap(ref, active, onEscape) {
  useEffect(() => {
    if (!active) return undefined;
    // 닫히면 열기 전 자리(예: 휴대폰 검색 단추)로 초점을 돌려줌 (11/16 코드 리뷰: 맨 앞으로 튐)
    const prev = document.activeElement;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        onEscape?.();
        return;
      }
      if (e.key !== 'Tab' || !ref.current) return;
      const items = [...ref.current.querySelectorAll(FOCUSABLE)];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      // 초점을 잃은 때만(창이 사라져 body 로 감): 결과를 눌러 다른 화면으로 가며 제목에 초점을 준 경우는 그대로 둠
      const lost = !document.activeElement || document.activeElement === document.body;
      if (lost && prev instanceof HTMLElement && prev.isConnected && !ref.current?.isConnected) prev.focus({ preventScroll: true });
    };
  }, [ref, active, onEscape]);
}
