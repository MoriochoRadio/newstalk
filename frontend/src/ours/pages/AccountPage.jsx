// 내 계정 (11/18 사용자: 계정 메뉴에 로그아웃·관심 종목밖에 없음 → 탈퇴·비밀번호·잊었을 때 찾기 등 편의 기능)
// 위에서부터: 내 정보 → 비밀번호 바꾸기 → 확인 질문(잊었을 때 찾기용) → 탈퇴(맨 아래, 비밀번호 + 확인 체크)
// 중요한 일은 모두 지금 비밀번호를 한 번 더 받음 (서버도 같은 규칙, 10분에 5번까지)
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { KeyRound, LogIn, ShieldQuestion, Trash2, UserRound } from 'lucide-react';
import { authApi } from '../../api';
import { useSession } from '../app/session';
import { useTitle } from '../lib/hooks';
import { errorText } from '../lib/errors';
import { Field, QuestionSelect } from '../components/AuthModal';
import { Empty } from '../components/ui';

const joinDate = (iso) => new Date(iso).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric' });

/** 폼 한 묶음의 보내는 중·오류·완료 상태 */
function useForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async (fn) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      return true;
    } catch (err) {
      setError(errorText(err, '처리하지 못했어요. 잠시 후 다시 시도해 주세요.'));
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, setError, run };
}

function PasswordCard() {
  const { toast } = useSession();
  const f = useForm();
  const [cur, setCur] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    if (!cur) return f.setError('지금 비밀번호를 입력해 주세요.');
    if (pw.length < 8 || pw.length > 64) return f.setError('새 비밀번호는 8~64자로 입력해 주세요.');
    if (pw !== pw2) return f.setError('새 비밀번호가 서로 달라요.');
    if (await f.run(() => authApi.changePassword(cur, pw))) {
      setCur('');
      setPw('');
      setPw2('');
      toast('비밀번호를 바꿨어요. 다음 로그인부터 새 비밀번호를 써 주세요.');
    }
    return undefined;
  };
  return (
    <section className="card acc-card" aria-labelledby="acc-pw">
      <h2 className="card-title" id="acc-pw">
        <KeyRound className="icon" aria-hidden="true" />
        비밀번호 바꾸기
      </h2>
      <form className="acc-form" onSubmit={submit} noValidate>
        <Field id="acc-cur" label="지금 비밀번호">
          <input id="acc-cur" type="password" className="input" autoComplete="current-password" value={cur} maxLength={64} onChange={(e) => setCur(e.target.value)} />
        </Field>
        <Field id="acc-new" label="새 비밀번호" help="8~64자">
          <input id="acc-new" type="password" className="input" autoComplete="new-password" value={pw} maxLength={64} onChange={(e) => setPw(e.target.value)} />
        </Field>
        <Field id="acc-new2" label="새 비밀번호 확인">
          <input id="acc-new2" type="password" className="input" autoComplete="new-password" value={pw2} maxLength={64} onChange={(e) => setPw2(e.target.value)} />
        </Field>
        {f.error && (
          <p className="form-error" role="alert">
            {f.error}
          </p>
        )}
        <button type="submit" className="btn btn-primary" disabled={f.busy}>
          {f.busy ? '바꾸는 중…' : '비밀번호 바꾸기'}
        </button>
      </form>
    </section>
  );
}

function RecoveryCard({ current }) {
  const { toast, reloadMe } = useSession();
  const f = useForm();
  const [question, setQuestion] = useState(current?.code || '');
  const [answer, setAnswer] = useState('');
  const [pw, setPw] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    if (!question) return f.setError('질문을 골라 주세요.');
    if (!answer.trim()) return f.setError('답을 입력해 주세요.');
    if (!pw) return f.setError('비밀번호를 입력해 주세요.');
    if (await f.run(() => authApi.setRecovery(pw, question, answer))) {
      setAnswer('');
      setPw('');
      await reloadMe().catch(() => {});
      toast(current ? '확인 질문을 바꿨어요.' : '확인 질문을 정했어요. 이제 비밀번호·아이디를 잊어도 찾을 수 있어요.');
    }
    return undefined;
  };
  return (
    <section className="card acc-card" aria-labelledby="acc-q">
      <h2 className="card-title" id="acc-q">
        <ShieldQuestion className="icon" aria-hidden="true" />
        확인 질문
      </h2>
      <p className="sub acc-state">
        {current ? (
          <>
            지금 질문: <b>{current.text}</b>
          </>
        ) : (
          <span className="acc-warn">아직 정하지 않았어요. 연락처를 받지 않는 서비스라, 정하지 않으면 비밀번호를 잊었을 때 되찾을 수 없어요.</span>
        )}
      </p>
      <form className="acc-form" onSubmit={submit} noValidate>
        <Field id="acc-qs" label={current ? '새 질문' : '질문'}>
          <QuestionSelect id="acc-qs" value={question} onChange={setQuestion} />
        </Field>
        <Field id="acc-ans" label="답" help="띄어쓰기·영문 대소문자는 가리지 않아요. 답 원문은 저장하지 않아요">
          <input id="acc-ans" className="input" autoComplete="off" value={answer} maxLength={50} onChange={(e) => setAnswer(e.target.value)} />
        </Field>
        <Field id="acc-qpw" label="비밀번호" help="본인 확인용">
          <input id="acc-qpw" type="password" className="input" autoComplete="current-password" value={pw} maxLength={64} onChange={(e) => setPw(e.target.value)} />
        </Field>
        {f.error && (
          <p className="form-error" role="alert">
            {f.error}
          </p>
        )}
        <button type="submit" className="btn btn-secondary" disabled={f.busy}>
          {f.busy ? '저장하는 중…' : current ? '질문 바꾸기' : '질문 정하기'}
        </button>
      </form>
    </section>
  );
}

function DeleteCard() {
  const { afterDelete } = useSession();
  const navigate = useNavigate();
  const f = useForm();
  const [pw, setPw] = useState('');
  const [agree, setAgree] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!agree) return f.setError('지워지는 내용을 확인했다는 칸에 표시해 주세요.');
    if (!pw) return f.setError('비밀번호를 입력해 주세요.');
    if (await f.run(() => authApi.deleteAccount(pw))) {
      afterDelete();
      navigate('/', { replace: true });
    }
    return undefined;
  };
  return (
    <section className="card acc-card acc-danger" aria-labelledby="acc-del">
      <h2 className="card-title" id="acc-del">
        <Trash2 className="icon" aria-hidden="true" />
        탈퇴
      </h2>
      <ul className="acc-list">
        <li>관심 종목, 종목 토론에 쓴 글·댓글·공감이 함께 지워져요. 내 글에 남이 단 댓글도 같이 지워져요.</li>
        <li>지운 뒤에는 되돌릴 수 없고, 같은 아이디로 다시 가입할 수 있어요.</li>
      </ul>
      <form className="acc-form" onSubmit={submit} noValidate>
        <label className="acc-check">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          위 내용을 확인했어요
        </label>
        <Field id="acc-dpw" label="비밀번호">
          <input id="acc-dpw" type="password" className="input" autoComplete="current-password" value={pw} maxLength={64} onChange={(e) => setPw(e.target.value)} />
        </Field>
        {f.error && (
          <p className="form-error" role="alert">
            {f.error}
          </p>
        )}
        <button type="submit" className="btn btn-danger" disabled={f.busy || !agree}>
          {f.busy ? '지우는 중…' : '탈퇴하기'}
        </button>
      </form>
    </section>
  );
}

export default function AccountPage() {
  useTitle('내 계정');
  const { user, checking, openAuth, watchlist } = useSession();

  if (checking) return <div className="skeleton" style={{ height: 240, borderRadius: 'var(--radius)' }} />;
  if (!user) {
    return (
      <>
        <div className="page-head">
          <h1 className="page-title">내 계정</h1>
        </div>
        <div className="card">
          <Empty
            icon={UserRound}
            title="로그인하면 내 계정을 관리할 수 있어요"
            action={
              <button type="button" className="btn btn-primary btn-sm" onClick={() => openAuth('login')}>
                <LogIn className="icon-sm" aria-hidden="true" />
                로그인
              </button>
            }
          />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">내 계정</h1>
      </div>
      <div className="acc-grid">
        <section className="card acc-card acc-me" aria-labelledby="acc-me">
          <h2 className="card-title" id="acc-me">
            <UserRound className="icon" aria-hidden="true" />
            내 정보
          </h2>
          <dl className="acc-dl">
            <div>
              <dt>아이디</dt>
              <dd className="num">{user.loginId}</dd>
            </div>
            {user.createdAt && (
              <div>
                <dt>가입일</dt>
                <dd className="num">{joinDate(user.createdAt)}</dd>
              </div>
            )}
            <div>
              <dt>관심 종목</dt>
              <dd className="num">
                <Link to="/watchlist" className="link">
                  {watchlist.loaded ? `${watchlist.items.length}개` : '보기'}
                </Link>
              </dd>
            </div>
            <div>
              <dt>확인 질문</dt>
              <dd>{user.recoveryQuestion ? '정함' : <span className="acc-warn">정하지 않음</span>}</dd>
            </div>
          </dl>
          <p className="card-note">
            저장하는 정보는 아이디, 암호화한 비밀번호, 확인 질문 답의 암호값뿐이에요. 자세한 건{' '}
            <Link to="/notice#privacy" className="link">
              이용 안내
            </Link>
            에 있어요.
          </p>
        </section>
        <PasswordCard />
        <RecoveryCard key={user.recoveryQuestion?.code || 'none'} current={user.recoveryQuestion} />
        <DeleteCard />
      </div>
    </>
  );
}
