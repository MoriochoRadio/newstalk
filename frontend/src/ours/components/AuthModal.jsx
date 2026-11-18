// 로그인·회원가입·계정 찾기 창. 규칙은 서버와 같게 (docs/api.md: 아이디 영문 소문자·숫자 4~20자, 비밀번호 8~64자)
// 서버가 준 오류 문장(중복 아이디 409, 틀린 비밀번호 401 …)을 그대로 보여 줌
// 11/18: 이메일·휴대폰을 받지 않는 서비스라 비밀번호·아이디를 잊으면 되찾을 길이 없었음 → 가입 때(선택)·내 계정에서 정한 확인 질문으로 찾기
//   비밀번호 찾기 = 아이디 → 내 질문 → 답 + 새 비밀번호 / 아이디 찾기 = 질문 + 답 + 비밀번호 (답만으로는 남의 아이디가 보일 수 있어서)
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, X } from 'lucide-react';
import { authApi } from '../../api';
import { useSession } from '../app/session';
import { errorText } from '../lib/errors';
import { useQuestions } from '../lib/questions';
import { Segmented } from './ui';

const ID_RULE = /^[a-z0-9]{4,20}$/;

function validate(mode, loginId, password, password2, recovery) {
  const e = {};
  if (!loginId) e.loginId = '아이디를 입력해 주세요.';
  else if (mode === 'signup' && !ID_RULE.test(loginId)) e.loginId = '영문 소문자와 숫자로 4~20자를 입력해 주세요.';
  if (!password) e.password = '비밀번호를 입력해 주세요.';
  else if (mode === 'signup' && (password.length < 8 || password.length > 64)) e.password = '8~64자로 입력해 주세요.';
  if (mode === 'signup' && password && password2 !== password) e.password2 = '비밀번호가 서로 달라요.';
  if (mode === 'signup' && recovery.question && !recovery.answer.trim()) e.answer = '답을 입력하거나 질문을 ‘정하지 않음’으로 두세요.';
  return e;
}

/** 입력칸 하나 (이름표 + 도움말/오류). 창 안 여러 곳에서 같은 모양 */
export function Field({ id, label, error, help, children }) {
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {children}
      <p id={`${id}-help`} className={`field-help ${error ? 'error' : ''}`}>
        {error || help || ''}
      </p>
    </div>
  );
}

/** 확인 질문 고르기 (가입·아이디 찾기·내 계정에서 같이 씀). allowNone: '정하지 않음' 칸 */
export function QuestionSelect({ id, value, onChange, allowNone = false }) {
  const questions = useQuestions();
  return (
    <select id={id} className="input select" value={value} onChange={(e) => onChange(e.target.value)}>
      {allowNone ? <option value="">정하지 않음</option> : <option value="">질문을 골라 주세요</option>}
      {questions.map((q) => (
        <option key={q.code} value={q.code}>
          {q.text}
        </option>
      ))}
    </select>
  );
}

/** 계정 찾기: 비밀번호 찾기 / 아이디 찾기 */
function Recover({ onDone, onBack, firstRef }) {
  const { toast } = useSession();
  const [tab, setTab] = useState('password');
  const [loginId, setLoginId] = useState('');
  const [question, setQuestion] = useState(null); // 비밀번호 찾기: 받은 내 질문 {code,text}
  const [answer, setAnswer] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [pickQ, setPickQ] = useState('');
  const [found, setFound] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = (next) => {
    setTab(next);
    setQuestion(null);
    setAnswer('');
    setPw('');
    setPw2('');
    setFound('');
    setError('');
  };

  const run = async (fn) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(errorText(err, '처리하지 못했어요. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (tab === 'password' && !question) {
      if (!loginId.trim()) return setError('아이디를 입력해 주세요.');
      return run(async () => setQuestion(await authApi.questionOf(loginId.trim())));
    }
    if (tab === 'password') {
      if (!answer.trim()) return setError('답을 입력해 주세요.');
      if (pw.length < 8 || pw.length > 64) return setError('새 비밀번호는 8~64자로 입력해 주세요.');
      if (pw !== pw2) return setError('새 비밀번호가 서로 달라요.');
      return run(async () => {
        await authApi.resetPassword(loginId.trim(), answer, pw);
        toast('비밀번호를 새로 정했어요. 새 비밀번호로 로그인해 주세요.');
        onDone(loginId.trim());
      });
    }
    if (!pickQ) return setError('가입할 때 정한 질문을 골라 주세요.');
    if (!answer.trim() || !pw) return setError('답과 비밀번호를 입력해 주세요.');
    return run(async () => setFound((await authApi.findLoginId(pickQ, answer, pw)).loginId));
  };

  return (
    <>
      <div className="recover-tabs">
        <Segmented
          label="찾을 것"
          size="sm"
          options={[
            { key: 'password', label: '비밀번호 찾기' },
            { key: 'id', label: '아이디 찾기' },
          ]}
          value={tab}
          onChange={reset}
        />
      </div>
      <p className="modal-desc">
        {tab === 'password'
          ? '가입하거나 내 계정에서 정한 확인 질문의 답이 맞으면 새 비밀번호를 정할 수 있어요.'
          : '확인 질문·답과 비밀번호가 모두 맞는 계정의 아이디를 알려 드려요.'}
      </p>
      {found ? (
        <div className="recover-found" role="status">
          <p>
            찾은 아이디는 <b className="num">{found}</b>이에요.
          </p>
          <button type="button" className="btn btn-primary" onClick={() => onDone(found)}>
            이 아이디로 로그인
          </button>
        </div>
      ) : (
        <form className="modal-form" onSubmit={onSubmit} noValidate>
          {tab === 'password' ? (
            <>
              <Field id="rc-id" label="아이디">
                <input
                  id="rc-id"
                  ref={firstRef}
                  className="input"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={loginId}
                  maxLength={20}
                  readOnly={Boolean(question)}
                  onChange={(e) => setLoginId(e.target.value.toLowerCase())}
                />
              </Field>
              {question && (
                <>
                  <Field id="rc-ans" label={question.text} help="띄어쓰기·영문 대소문자는 가리지 않아요">
                    <input id="rc-ans" className="input" autoComplete="off" value={answer} maxLength={50} onChange={(e) => setAnswer(e.target.value)} autoFocus />
                  </Field>
                  <Field id="rc-pw" label="새 비밀번호" help="8~64자">
                    <input id="rc-pw" type="password" className="input" autoComplete="new-password" value={pw} maxLength={64} onChange={(e) => setPw(e.target.value)} />
                  </Field>
                  <Field id="rc-pw2" label="새 비밀번호 확인">
                    <input id="rc-pw2" type="password" className="input" autoComplete="new-password" value={pw2} maxLength={64} onChange={(e) => setPw2(e.target.value)} />
                  </Field>
                </>
              )}
            </>
          ) : (
            <>
              <Field id="rc-q" label="확인 질문">
                <QuestionSelect id="rc-q" value={pickQ} onChange={setPickQ} />
              </Field>
              <Field id="rc-ans2" label="답" help="띄어쓰기·영문 대소문자는 가리지 않아요">
                <input id="rc-ans2" className="input" autoComplete="off" value={answer} maxLength={50} onChange={(e) => setAnswer(e.target.value)} />
              </Field>
              <Field id="rc-pw3" label="비밀번호">
                <input id="rc-pw3" type="password" className="input" autoComplete="current-password" value={pw} maxLength={64} onChange={(e) => setPw(e.target.value)} />
              </Field>
            </>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn-primary" disabled={busy} style={{ marginTop: 4 }}>
            {busy ? '확인하는 중…' : tab === 'password' ? (question ? '새 비밀번호 정하기' : '다음') : '아이디 찾기'}
          </button>
        </form>
      )}
      <p className="modal-switch">
        <button type="button" className="link" onClick={onBack}>
          <ArrowLeft className="icon-sm" aria-hidden="true" style={{ verticalAlign: -2 }} /> 로그인으로 돌아가기
        </button>
      </p>
      <p className="modal-fine">확인 질문을 정하지 않은 계정은 이 서비스가 연락처를 받지 않아 되찾을 수 없어요. 새로 가입해 주세요.</p>
    </>
  );
}

export default function AuthModal() {
  const { authModal, closeAuth, openAuth, login, signup, toast } = useSession();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [recovery, setRecovery] = useState({ question: '', answer: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);
  const firstRef = useRef(null);
  const closeRef = useRef(closeAuth);
  closeRef.current = closeAuth;
  const dialogRef = useRef(null);
  const mode = authModal?.mode || 'login';

  useEffect(() => {
    if (!authModal) return undefined;
    setErrors({});
    setServerError('');
    setPassword('');
    setPassword2('');
    setRecovery({ question: '', answer: '' });
    const prev = document.activeElement;
    firstRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') closeRef.current();
      // 창 안에서만 Tab 이 돌게
      if (e.key === 'Tab' && dialogRef.current) {
        // 꺼진 버튼은 초점을 못 받으니 빼야 Tab 이 끝에서 처음으로 돎 (11/17 QA, lib/focusTrap 과 같은 기준)
        const items = dialogRef.current.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href]');
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
    // 열릴 때(authModal 이 바뀔 때)만: closeAuth 가 바뀌어도 다시 돌지 않게 (입력값·초점 유지)
  }, [authModal]);

  if (!authModal) return null;
  const isSignup = mode === 'signup';
  const isRecover = mode === 'recover';

  const onSubmit = async (e) => {
    e.preventDefault();
    const id = loginId.trim();
    const v = validate(mode, id, password, password2, recovery);
    setErrors(v);
    setServerError('');
    if (Object.keys(v).length) return;
    setBusy(true);
    try {
      const me = isSignup ? await signup(id, password, recovery.question ? recovery : null) : await login(id, password);
      toast(isSignup ? `가입했어요. 반가워요, ${me.loginId}님.` : `${me.loginId}님, 로그인했어요.`);
      closeAuth();
    } catch (err) {
      setServerError(errorText(err, isSignup ? '가입하지 못했어요. 잠시 후 다시 시도해 주세요.' : '로그인하지 못했어요.'));
    } finally {
      setBusy(false);
    }
  };

  const title = isRecover ? '아이디·비밀번호 찾기' : isSignup ? '회원가입' : '로그인';

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && closeAuth()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="auth-title" ref={dialogRef}>
        <div className="modal-head">
          <h2 className="modal-title" id="auth-title">
            {title}
          </h2>
          <button type="button" className="icon-btn" aria-label="닫기" onClick={closeAuth}>
            <X className="icon" aria-hidden="true" />
          </button>
        </div>
        {isRecover ? (
          <Recover
            firstRef={firstRef}
            onBack={() => openAuth('login', authModal.reason)}
            onDone={(id) => {
              setLoginId(id);
              openAuth('login', authModal.reason);
            }}
          />
        ) : (
          <>
            <p className="modal-desc">{authModal.reason || (isSignup ? '아이디와 비밀번호만 있으면 가입할 수 있어요.' : '관심 종목과 토론은 로그인하면 쓸 수 있어요.')}</p>
            <form className="modal-form" onSubmit={onSubmit} noValidate>
              <Field id="auth-id" label="아이디" error={errors.loginId} help={isSignup ? '영문 소문자·숫자 4~20자' : ''}>
                <input
                  id="auth-id"
                  ref={firstRef}
                  className="input"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={loginId}
                  maxLength={20}
                  // 아이디는 소문자만 (서버 규칙). 휴대폰 키보드가 첫 글자를 대문자로 바꿔도 막히지 않게 바로 소문자로 (11/13 사용자 눈으로)
                  onChange={(e) => setLoginId(e.target.value.toLowerCase())}
                  aria-invalid={Boolean(errors.loginId)}
                  aria-describedby="auth-id-help"
                />
              </Field>
              <Field id="auth-pw" label="비밀번호" error={errors.password} help={isSignup ? '8~64자' : ''}>
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
              </Field>
              {isSignup && (
                <>
                  <Field id="auth-pw2" label="비밀번호 확인" error={errors.password2}>
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
                  </Field>
                  {/* 선택: 정하지 않으면 잊었을 때 되찾을 길이 없다는 것을 바로 아래에 */}
                  <Field id="auth-q" label="확인 질문 (선택)" help="비밀번호·아이디를 잊었을 때 이 답으로 찾아요. 나중에 내 계정에서도 정할 수 있어요">
                    <QuestionSelect id="auth-q" value={recovery.question} allowNone onChange={(question) => setRecovery((r) => ({ ...r, question }))} />
                  </Field>
                  {recovery.question && (
                    <Field id="auth-ans" label="답" error={errors.answer} help="띄어쓰기·영문 대소문자는 가리지 않아요. 답 원문은 저장하지 않아요">
                      <input
                        id="auth-ans"
                        className="input"
                        autoComplete="off"
                        value={recovery.answer}
                        maxLength={50}
                        onChange={(e) => setRecovery((r) => ({ ...r, answer: e.target.value }))}
                        aria-invalid={Boolean(errors.answer)}
                        aria-describedby="auth-ans-help"
                      />
                    </Field>
                  )}
                </>
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
            {!isSignup && (
              <p className="modal-switch modal-forgot">
                <button type="button" className="link" onClick={() => openAuth('recover', authModal.reason)}>
                  아이디·비밀번호를 잊었어요
                </button>
              </p>
            )}
            <p className="modal-switch">
              {isSignup ? '이미 계정이 있나요? ' : '처음이신가요? '}
              <button type="button" className="link" onClick={() => openAuth(isSignup ? 'login' : 'signup', authModal.reason)}>
                {isSignup ? '로그인' : '회원가입'}
              </button>
            </p>
            {isSignup && (
              <p className="modal-fine">
                가입하면{' '}
                <Link to="/notice#privacy" onClick={closeAuth}>
                  이용 안내·개인정보 처리
                </Link>
                를 읽은 것으로 봐요.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
