// 앱 틀: 데스크톱은 왼쪽 메뉴 + 위 검색줄, 휴대폰(768 이하)은 위 작은 줄 + 아래 탭 4개
// 면책 문구는 맨 아래 한 번만. 화면을 옮기면(뒤로 가기 제외) 맨 위로
import { Suspense, useCallback, useEffect, useRef, useState, useLayoutEffect } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigationType } from 'react-router-dom';
import { CandlestickChart, Home, LayoutGrid, LogIn, LogOut, Moon, Newspaper, PanelLeftClose, PanelLeftOpen, Search, Settings, Star, Sun, User } from 'lucide-react';
import { useSession } from './session';
import LivePill from '../components/LivePill';
import { useNetStatus } from '../lib/netStatus';
import SearchBox from '../components/SearchBox';
import AuthModal from '../components/AuthModal';
import { useFocusTrap } from '../lib/focusTrap';
import { SkeletonRows } from '../components/ui';
import ErrorBoundary from '../components/ErrorBoundary';

const NAV = [
  { to: '/', label: '홈', icon: Home, end: true },
  { to: '/news', label: '뉴스·공시', icon: Newspaper },
  { to: '/map', label: '시장 지도', icon: LayoutGrid },
  { to: '/stocks', label: '종목', icon: CandlestickChart },
  { to: '/watchlist', label: '관심 종목', icon: Star },
];

const THEME_KEY = 'snm_ours_theme';

function readTheme() {
  try {
    return localStorage.getItem(THEME_KEY) || '';
  } catch {
    return '';
  }
}

/** 지금 보이는 테마 (직접 고른 값이 없으면 운영체제 설정) */
function effectiveTheme(choice) {
  if (choice) return choice;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function useTheme() {
  const [choice, setChoice] = useState(readTheme);
  useEffect(() => {
    const root = document.documentElement;
    if (choice) root.setAttribute('data-theme', choice);
    else root.removeAttribute('data-theme');
    try {
      if (choice) localStorage.setItem(THEME_KEY, choice);
      else localStorage.removeItem(THEME_KEY);
    } catch {
      // 저장 못 해도 이번 화면에서는 적용
    }
  }, [choice]);
  const toggle = () => setChoice((c) => (effectiveTheme(c) === 'dark' ? 'light' : 'dark'));
  return { dark: effectiveTheme(choice) === 'dark', toggle };
}

// 11/18 로고 확정: 신문 위 캔들·상승 화살표 아이콘(흰 둥근 판) + '뉴스톡' (뉴스 = 남색, 톡 = 파랑, 로고와 같은 색 나눔)
const Mark = () => <img className="brand-mark brand-logo" src="/brand/logo-mark.png" alt="" width="32" height="32" aria-hidden="true" />;
const Wordmark = () => (
  <span className="brand-word">
    뉴스<span className="brand-word-accent">톡</span>
  </span>
);

function UserMenu() {
  const { user, checking, openAuth, logout } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (checking) return <div className="skeleton" style={{ width: 88, height: 36, borderRadius: 999 }} />;
  if (!user) {
    return (
      <button type="button" className="btn btn-primary btn-sm" onClick={() => openAuth('login')}>
        <LogIn className="icon-sm" aria-hidden="true" />
        로그인
      </button>
    );
  }
  return (
    <div className="menu" ref={ref}>
      <button type="button" className="user-chip" aria-expanded={open} aria-controls="user-menu" onClick={() => setOpen((o) => !o)}>
        <span className="avatar" aria-hidden="true">
          <User className="icon-sm" />
        </span>
        <span className="name">{user.loginId}</span>
        <span className="sr-only">계정 메뉴</span>
      </button>
      {open && (
        // 펼치기 버튼 + 보통 링크·버튼 (화살표 키 이동이 없는데 menu 역할을 붙이면 낭독기가 메뉴 조작을 안내해서 혼란 — 11/12 점검)
        <div className="menu-pop" id="user-menu">
          <p className="menu-who">{user.loginId}님</p>
          <Link to="/watchlist" className="menu-item" onClick={() => setOpen(false)}>
            <Star className="icon-sm" aria-hidden="true" />
            관심 종목
          </Link>
          {/* 11/18: 비밀번호 바꾸기·확인 질문·탈퇴 */}
          <Link to="/account" className="menu-item" onClick={() => setOpen(false)}>
            <Settings className="icon-sm" aria-hidden="true" />
            내 계정
          </Link>
          <button
            type="button"
            className="menu-item"
            onClick={() => {
              setOpen(false);
              logout();
            }}
          >
            <LogOut className="icon-sm" aria-hidden="true" />
            로그아웃
          </button>
        </div>
      )}
    </div>
  );
}

// 왼쪽 메뉴 접기·펼치기 (11/12 사용자: "사이드바가 공간을 과하게 차지, 원래 꺼냈다 닫았다 하는 게 기본")
// 접으면 아이콘만 남는 좁은 띠(64px). 고른 값은 이 브라우저에 기억, 처음엔 화면이 좁으면(1280 미만) 접힌 채로
const NAV_KEY = 'snm_nav_collapsed';
const SHOW_DEV_LINKS = (() => {
  if (!import.meta.env.DEV) return false;
  try {
    if (new URLSearchParams(window.location.search).has('dev')) localStorage.setItem('snm_dev', '1');
    return localStorage.getItem('snm_dev') === '1';
  } catch {
    return false;
  }
})();
function useNavCollapsed() {
  const [collapsed, setCollapsed] = useState(() => {
    // 주소 ?nav=collapsed|open 이 있으면 그것 (링크 공유·캡처용, 11/18)
    const q = new URLSearchParams(window.location.search).get('nav');
    if (q === 'collapsed' || q === 'open') return q === 'collapsed';
    try {
      const v = localStorage.getItem(NAV_KEY);
      if (v != null) return v === '1';
    } catch {
      /* 저장소를 못 쓰면 화면 폭으로 */
    }
    return window.innerWidth < 1280;
  });
  useEffect(() => {
    document.documentElement.toggleAttribute('data-nav-collapsed', collapsed);
  }, [collapsed]);
  const toggleNav = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem(NAV_KEY, c ? '0' : '1');
      } catch {
        /* 기억 못 해도 지금 화면은 바뀜 */
      }
      return !c;
    });
  return [collapsed, toggleNav];
}

/** 서버 연결 띠: 끊기면 한 번만 크게, 다시 연결되면 '새로 불러오기' (카드마다 반복되던 긴 오류 대신) */
function NetBanner() {
  const { offline, recovered } = useNetStatus();
  if (!offline && !recovered) return null;
  return (
    <div className={`net-banner ${offline ? 'off' : 'on'}`} role="status">
      {offline ? (
        <span>서버와 연결이 끊겼어요. 다시 연결되는지 10초마다 확인하고 있어요.</span>
      ) : (
        <>
          <span>다시 연결됐어요.</span>
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => window.location.reload()}>
            새로 불러오기
          </button>
        </>
      )}
    </div>
  );
}

/** 알림 하나. 정해진 시간 뒤 사라지되, 마우스를 올리거나 버튼에 초점이 있는 동안은 멈춤 */
function Toast({ t, onDismiss }) {
  const [hold, setHold] = useState(false);
  useEffect(() => {
    if (hold) return undefined;
    const timer = setTimeout(() => onDismiss(t.id), t.ms || 3000);
    return () => clearTimeout(timer);
  }, [hold, t.id, t.ms, onDismiss]);
  return (
    <div
      className={`toast ${t.tone === 'error' ? 'error' : ''}`}
      role={t.tone === 'error' ? 'alert' : undefined}
      onMouseEnter={() => setHold(true)}
      onMouseLeave={() => setHold(false)}
      onFocus={() => setHold(true)}
      onBlur={() => setHold(false)}
    >
      <span className="toast-msg">{t.message}</span>
      {t.action && (
        <button
          type="button"
          className="toast-action"
          onClick={() => {
            onDismiss(t.id);
            t.action.run();
          }}
        >
          {t.action.label}
        </button>
      )}
    </div>
  );
}

export default function Shell() {
  const { dark, toggle } = useTheme();
  const { toasts, dismissToast } = useSession();
  const location = useLocation();
  const navType = useNavigationType();
  const [mobileSearch, setMobileSearch] = useState(false);
  const [navCollapsed, toggleNav] = useNavCollapsed();
  const mobileSearchRef = useRef(null);
  const closeMobileSearch = useCallback(() => setMobileSearch(false), []);
  useFocusTrap(mobileSearchRef, mobileSearch, closeMobileSearch); // Esc 로 닫기 + Tab 가두기 (11/12 코드 점검)

  // 새 화면은 맨 위부터 (뒤로 가기는 브라우저가 기억한 위치)
  // + 초점을 본문으로 (11/13 키보드 점검: 기사를 열면 초점이 문서 처음으로 돌아가 Tab 을 10번 넘게 다시 눌러야 본문). 첫 화면은 그대로
  const firstRoute = useRef(true);
  // 뒤로 가기 위치 (11/16 밤 액터: 목록을 1000px 내려 기사를 열고 돌아오면 188px).
  // 목록은 돌아온 뒤 다시 받아서 처음엔 짧음 → 브라우저가 위치를 못 맞춤. 화면마다(location.key) 위치를 적어 두고,
  // 뒤로 가기면 목록이 그만큼 길어질 때까지(최대 3초) 기다렸다가 맞춤
  // 키 = 기록 key + 주소: 건너뛰기 링크(#main)처럼 해시만 바꾸면 react-router 가 key 'default'(첫 화면과 같은 값)를 줘서
  // 첫 화면 위치(예: 1500px)로 끌려갔음 (3차 코드 리뷰). 새로고침해도 기억하게 sessionStorage 에 같이 둠
  const posKey = (loc) => `${loc.key}|${loc.pathname}${loc.search}`;
  const scrollPos = useRef(null);
  if (!scrollPos.current) {
    let saved = [];
    try {
      saved = JSON.parse(sessionStorage.getItem('snm_scroll_pos') || '[]');
    } catch {
      saved = [];
    }
    // 저장값이 깨졌으면(형식이 다르면) 버림 — new Map 이 예외를 던져 화면이 깨지지 않게 (4차 코드 리뷰)
    scrollPos.current = new Map(Array.isArray(saved) ? saved.filter((x) => Array.isArray(x) && x.length === 2 && typeof x[1] === 'number') : []);
  }
  const keyRef = useRef(posKey(location));
  const pathRef = useRef(null); // 직전 화면 주소 (첫 화면은 없음)
  // 첫 화면은 새로고침·브라우저 뒤로/앞으로로 왔을 때만 되살림 (주소를 새로 쳐서 왔으면 맨 위). 개발 모드 이중 실행에도 같은 답이 되게 한 번만 셈
  const firstKey = useRef(null);
  if (firstKey.current === null) {
    const type = performance.getEntriesByType?.('navigation')?.[0]?.type;
    firstKey.current = { loc: location, restore: type === 'reload' || type === 'back_forward' }; // 같은 기록으로 나중에 돌아온 것과 구분하려고 위치 객체를 비교
    // 주소를 새로 쳐서 연 첫 화면은 기록 key 가 늘 'default' 라, 같은 탭에서 예전에 연 같은 주소의 위치가 남아 있으면 뒤로 가기 때 그리로 끌려갔음 (4차 코드 리뷰) → 지움
    if (!firstKey.current.restore) scrollPos.current.delete(posKey(location));
  }
  useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
    // 타이머로 (requestAnimationFrame 은 가려진 창에서 멈춰 위치가 안 적혔음)
    let timer = 0;
    const onScroll = () => {
      if (restoringRef.current) return; // 위치를 되살리는 중의 스크롤(덜 내려간 값)은 적지 않음 (4차 코드 리뷰)
      clearTimeout(timer);
      timer = setTimeout(() => {
        const m = scrollPos.current;
        m.delete(keyRef.current);
        m.set(keyRef.current, window.scrollY);
        while (m.size > 50) m.delete(m.keys().next().value); // 오래된 것부터 지움
        try {
          sessionStorage.setItem('snm_scroll_pos', JSON.stringify([...m]));
        } catch {
          // 저장 못 해도 이번 창에서는 기억함
        }
      }, 60);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      clearTimeout(timer);
    };
  }, []);
  // 화면이 바뀌면 그리기 전에 '지금 화면' 표시부터 바꿈: 새 화면이 짧아 브라우저가 스크롤을 줄일 때 그 값이 이전 화면 위치를 덮어썼음
  const hashOnly = useRef(false);
  const restoringRef = useRef(false);
  useLayoutEffect(() => {
    keyRef.current = posKey(location);
    const path = `${location.pathname}${location.search}`;
    // 같은 화면 안에서 해시만 바뀜 (건너뛰기 링크·바로 가기). 같은 기록을 다시 실행(개발 모드 이중 실행)한 것은 제외
    const prev = pathRef.current;
    if (!prev || prev.key !== location.key) hashOnly.current = Boolean(prev) && prev.path === path;
    pathRef.current = { key: location.key, path };
  }, [location.key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (navType !== 'POP' || hashOnly.current) return undefined;
    if (location === firstKey.current.loc && !firstKey.current.restore) return undefined;
    const target = scrollPos.current.get(posKey(location)) || 0;
    if (!target) return undefined;
    let timer = 0;
    const until = performance.now() + 3000;
    // 3초 동안 목록 길이가 바뀔 때마다 다시 맞춤 (돌아오면 목록을 다시 받으며 잠깐 뼈대로 짧아져 맞춘 위치가 0으로 밀렸음)
    let steady = 0; // 목표에 닿은 채 지난 횟수 (10번 = 0.5초면 일찍 멈춤)
    const tryRestore = () => {
      const room = document.documentElement.scrollHeight - window.innerHeight;
      const want = Math.min(target, Math.max(0, room));
      if (Math.abs(window.scrollY - want) > 2) window.scrollTo({ top: want, left: 0, behavior: 'instant' });
      steady = want === target && Math.abs(window.scrollY - target) <= 2 ? steady + 1 : 0;
      if (steady < 10 && performance.now() < until) timer = setTimeout(tryRestore, 50);
      else restoringRef.current = false;
    };
    restoringRef.current = true;
    timer = setTimeout(tryRestore, 0);
    // 사용자가 직접 스크롤·키보드를 쓰면 그만
    const stop = () => {
      clearTimeout(timer);
      restoringRef.current = false;
    };
    const opts = { once: true, passive: true };
    ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach((ev) => window.addEventListener(ev, stop, opts));
    return () => {
      clearTimeout(timer);
      restoringRef.current = false;
      ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach((ev) => window.removeEventListener(ev, stop));
    };
  }, [location.key, navType]);
  useEffect(() => {
    // behavior 'instant': html 에 scroll-behavior: smooth 가 있어 미끄러지는 동안 새 화면 내용이 바뀌면 중간(188·598px)에서 멈췄음 (11/16 밤)
    if (navType !== 'POP') window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    setMobileSearch(false);
    if (firstRoute.current) {
      firstRoute.current = false;
      return;
    }
    document.getElementById('main')?.focus({ preventScroll: true });
  }, [location.pathname, navType]);

  const ThemeIcon = dark ? Sun : Moon;
  const themeLabel = dark ? '밝은 화면으로' : '어두운 화면으로';

  return (
    <div className="shell">
      <a
        href="#main"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault();
          const main = document.getElementById('main');
          main?.focus();
        }}
      >
        본문으로 건너뛰기
      </a>
      <aside className="sidenav" aria-label="사이드바">
        <div className="brand-row">
          <Link to="/" className="brand" aria-label="뉴스톡 홈">
            <Mark />
            <span className="nav-text">
              <Wordmark />
              <span className="brand-sub">뉴스로 보는 종목</span>
            </span>
          </Link>
          <button
            type="button"
            className="icon-btn nav-toggle"
            aria-expanded={!navCollapsed}
            aria-label={navCollapsed ? '메뉴 펼치기' : '메뉴 접기'}
            title={navCollapsed ? '메뉴 펼치기' : '메뉴 접기'}
            onClick={toggleNav}
          >
            {navCollapsed ? <PanelLeftOpen className="icon" aria-hidden="true" /> : <PanelLeftClose className="icon" aria-hidden="true" />}
          </button>
        </div>
        {/* 이름은 nav 에 (11/13 낭독기 구조 점검: 바깥 aside 에만 이름이 있어 '이름 없는 길잡이'로 들렸음) */}
        <nav aria-label="주 메뉴">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} title={navCollapsed ? label : undefined} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Icon className="icon" aria-hidden="true" />
              <span className="nav-text">{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="nav-spacer" />
        <div className="nav-foot">
          <button type="button" className="nav-link" onClick={toggle} title={navCollapsed ? themeLabel : undefined}>
            <ThemeIcon className="icon" aria-hidden="true" />
            <span className="nav-text">{themeLabel}</span>
          </button>
          {/* 개발용 비교 링크: 일반 사용자에겐 'V7'이 무슨 뜻인지 모름 (11/13 키보드 점검) → 개발 서버에서만.
              11/16 리뷰 3번: 시연을 개발 서버로 해도 안 보이게, 주소에 ?dev 를 한 번 붙여 열어야 보임. 주소 /v7 은 그대로 열림 */}
          {SHOW_DEV_LINKS && (
            <a className="nav-link" href="/v7" title={navCollapsed ? '이전 화면(V7) 비교' : undefined}>
              <Newspaper className="icon" aria-hidden="true" />
              <span className="nav-text">이전 화면(V7) 비교</span>
            </a>
          )}
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <Link to="/" className="mobile-brand" aria-label="뉴스톡 홈">
            <Mark />
            <span className="brand-text">
              <Wordmark />
            </span>
          </Link>
          <SearchBox className="desktop-search" />
          <div className="topbar-right">
            <LivePill className="desktop-only" />
            <button type="button" className="icon-btn mobile-only" aria-label="검색" onClick={() => setMobileSearch(true)}>
              <Search className="icon" aria-hidden="true" />
            </button>
            <button type="button" className="icon-btn mobile-only" aria-label={themeLabel} onClick={toggle}>
              <ThemeIcon className="icon" aria-hidden="true" />
            </button>
            <UserMenu />
          </div>
        </header>

        {mobileSearch && (
          <div className="mobile-search" ref={mobileSearchRef} role="dialog" aria-modal="true" aria-label="검색">
            <div className="mobile-search-head">
              <SearchBox autoFocus onDone={() => setMobileSearch(false)} placeholder="종목·뉴스 검색" />
              {/* 11/13 휴대폰: 입력칸의 '지우기 X' 바로 옆에 '닫기 X' 가 또 있어 헷갈림 → 휴대폰 앱처럼 글자 '취소' */}
              <button type="button" className="btn btn-ghost btn-sm mobile-search-cancel" onClick={() => setMobileSearch(false)}>
                취소
              </button>
            </div>
          </div>
        )}

        <main id="main" className="content" tabIndex={-1}>
          <NetBanner />
          <ErrorBoundary key={location.pathname}>
            <Suspense fallback={<SkeletonRows rows={6} />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>

        <footer className="footer">
          {/* 11/18 사용자: 다른 사이트처럼 잘 안 보이지만 늘 있는 '이용 안내·유의사항' (자세한 면책·개인정보·토론 규칙) */}
          <nav className="footer-links" aria-label="이용 안내">
            <Link to="/notice">이용 안내·유의사항</Link>
            <Link to="/notice#privacy">개인정보 처리</Link>
            <Link to="/notice#board">토론 이용 규칙</Link>
          </nav>
          {/* 11/17 QA: AI 기본법 제31조(생성형 AI 사용 사전 고지) 취지로 '생성형 AI' 임을 밝힘 */}
          요약·좋은/나쁜 소식·종목 연결은 생성형 AI(OpenAI)가 뉴스·공시를 읽고 만든 정보예요. 틀릴 수 있고 투자 권유가 아니며, 투자
          판단과 책임은 본인에게 있어요.
          <br />
          {/* 화면마다 따로 있던 같은 안내(홈·시장 지도·글 화면·크게 움직인 날)를 여기 한 곳으로 (11/16 리뷰 12번) */}
          등락률은 직전 거래일 종가와 비교한 값이에요. 시세와 기사를 나란히 보여 줄 뿐, 기사 때문에 주가가 움직였다는 뜻이 아니에요.
          <br />
          기사 저작권은 각 언론사에 있어요 · 시세 한국투자증권(KIS) · 공시 금융감독원 전자공시(DART, 원문은 DART에서 확인) · 차트{' '}
          {/* 차트 안 로고(attributionLogo) 대신 여기서 TradingView 출처·링크 (Lightweight Charts NOTICE 문구 그대로 + tradingview.com 링크) */}
          <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">
            TradingView Lightweight Charts™
          </a>{' '}
          Copyright (c) TradingView, Inc.
        </footer>
      </div>

      <nav className="tabbar" aria-label="주 메뉴">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}>
            <Icon className="icon" aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>

      <AuthModal />
      {/* 알림 상자 하나만 '조용히 읽기', 오류만 alert (안에 status 를 또 두면 두 번 읽힘 — 11/12 점검) */}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <Toast key={t.id} t={t} onDismiss={dismissToast} />
        ))}
      </div>
    </div>
  );
}
