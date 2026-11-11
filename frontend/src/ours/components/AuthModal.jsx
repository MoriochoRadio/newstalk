// 로그인·회원가입 창. 규칙은 서버와 같게 (docs/api.md: 아이디 영문 소문자·숫자 4~20자, 비밀번호 8~64자)
// 서버가 준 오류 문장(중복 아이디 409, 틀린 비밀번호 401 …)을 그대로 보여 줌. 아이디·비밀번호 찾기는 서버 기능이 없어 넣지 않음
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useSession } from '../app/session';
import { errorText } from '../lib/errors';

const ID_RULE = /^[a-z0-9]{4,20}$/;

function validate(mode, loginId, password, password2) {
  const e = {};
  if (!loginId) e.loginId = '아이디를 입력해 주세요.';
  else if (mode === 'signup' && !ID_RULE.test(loginId)) e.loginId = '영문 소문자와 숫자로 4~20자를 입력해 주세요.';
  if (!password) e.password = '비밀번호를 입력해 주세요.';
  else if (mode === 'signup' && (password.length < 8 || password.length > 64)) e.password = '8~64자로 입력해 주세요.';
  if (mode === 'signup' && password && password2 !== password) e.password2 = '비밀번호가 서로 달라요.';
  return e;
}

export default function AuthModal() {
  const { authModal, closeAuth, openAuth, login, signup, toast } = useSession();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);
  const firstRef = useRef(null);
  const dialogRef = useRef(null);
  const mode = authModal?.mode || 'login';

  useEffect(() => {
    if (!authModal) return undefined;
    setErrors({});
    setServerError('');
    setPassword('');
    setPassword2('');
    const prev = document.activeElement;
    firstRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') closeAuth();
      // 창 안에서만 Tab 이 돌게
      if (e.key === 'Tab' && dialogRef.current) {
        const items = dialogRef.current.querySelectorAll('button, input, a[href]');
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [authModal, closeAuth]);

  if (!authModal) return null;
  const isSignup = mode === 'signup';

  const onSubmit = async (e) => {
    e.preventDefault();
    const id = loginId.trim();
    const v = validate(mode, id, password, password2);
    setErrors(v);
    setServerError('');
    if (Object.keys(v).length) return;
    setBusy(true);
    try {
      const me = isSignup ? await signup(id, password) : await login(id, password);
      toast(isSignup ? `가입했어요. 반가워요, ${me.loginId}님.` : `${me.loginId}님, 로그인했어요.`);
      closeAuth();
    } catch (err) {
      setServerError(errorText(err, isSignup ? '가입하지 못했어요. 잠시 후 다시 시도해 주세요.' : '로그인하지 못했어요.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && closeAuth()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="auth-title" ref={dialogRef}>
        <div className="modal-head">
          <h2 className="modal-title" id="auth-title">
            {isSignup ? '회원가입' : '로그인'}
          </h2>
          <button type="button" className="icon-btn" aria-label="닫기" onClick={closeAuth}>
            <X className="icon" aria-hidden="true" />
          </button>
        </div>
        <p className="modal-desc">{authModal.reason || (isSignup ? '아이디와 비밀번호만 있으면 가입할 수 있어요.' : '관심 종목과 토론은 로그인하면 쓸 수 있어요.')}</p>
        <form className="modal-form" onSubmit={onSubmit} noValidate>
          <div className="field">
            <label className="field-label" htmlFor="auth-id">
              아이디
            </label>
            <input
              id="auth-id"
              ref={firstRef}
              className="input"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={loginId}
              maxLength={20}
              onChange={(e) => setLoginId(e.target.value)}
              aria-invalid={Boolean(errors.loginId)}
              aria-describedby="auth-id-help"
            />
            <p id="auth-id-help" className={`field-help ${errors.loginId ? 'error' : ''}`}>
              {errors.loginId || (isSignup ? '영문 소문자·숫자 4~20자' : '')}
            </p>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="auth-pw">
              비밀번호
            </label>
            <input
              id="auth-pw"
              type="password"
              className="input"
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              value={password}
              maxLength={64}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(errors.password)}
              aria-describedby="auth-pw-help"
            />
            <p id="auth-pw-help" className={`field-help ${errors.password ? 'error' : ''}`}>
              {errors.password || (isSignup ? '8~64자' : '')}
            </p>
          </div>
          {isSignup && (
            <div className="field">
              <label className="field-label" htmlFor="auth-pw2">
                비밀번호 확인
              </label>
              <input
                id="auth-pw2"
                type="password"
                className="input"
                autoComplete="new-password"
                value={password2}
                maxLength={64}
                onChange={(e) => setPassword2(e.target.value)}
                aria-invalid={Boolean(errors.password2)}
                aria-describedby="auth-pw2-help"
              />
              <p id="auth-pw2-help" className={`field-help ${errors.password2 ? 'error' : ''}`}>
                {errors.password2 || ''}
              </p>
            </div>
          )}
          {serverError && (
            <p className="form-error" role="alert">
              {serverError}
            </p>
          )}
          <button type="submit" className="btn btn-primary" disabled={busy} style={{ marginTop: 4 }}>
            {busy ? '처리하는 중…' : isSignup ? '가입하기' : '로그인'}
          </button>
        </form>
        <p className="modal-switch">
          {isSignup ? '이미 계정이 있나요? ' : '처음이신가요? '}
          <button type="button" className="link" onClick={() => openAuth(isSignup ? 'login' : 'signup', authModal.reason)}>
            {isSignup ? '로그인' : '회원가입'}
          </button>
        </p>
      </div>
    </div>
  );
}
