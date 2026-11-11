// 앱 틀: 데스크톱은 왼쪽 메뉴 + 위 검색줄, 휴대폰(768 이하)은 위 작은 줄 + 아래 탭 4개
// 면책 문구는 맨 아래 한 번만. 화면을 옮기면(뒤로 가기 제외) 맨 위로
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigationType } from 'react-router-dom';
import { CandlestickChart, Home, LogIn, LogOut, Moon, Newspaper, Search, Star, Sun, User, X } from 'lucide-react';
import { useSession } from './session';
import SearchBox from '../components/SearchBox';
import AuthModal from '../components/AuthModal';

const NAV = [
  { to: '/', label: '홈', icon: Home, end: true },
  { to: '/news', label: '뉴스·공시', icon: Newspaper },
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

const Mark = () => (
  <span className="brand-mark" aria-hidden="true">
    <CandlestickChart className="icon-sm" />
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
      <button type="button" className="user-chip" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="avatar" aria-hidden="true">
          <User className="icon-sm" />
        </span>
        <span className="name">{user.loginId}</span>
        <span className="sr-only">계정 메뉴</span>
      </button>
      {open && (
        <div className="menu-pop" role="menu">
          <p className="menu-who">{user.loginId}님</p>
          <Link to="/watchlist" className="menu-item" role="menuitem" onClick={() => setOpen(false)}>
            <Star className="icon-sm" aria-hidden="true" />
            관심 종목
          </Link>
          <button
            type="button"
            className="menu-item"
            role="menuitem"
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

export default function Shell() {
  const { dark, toggle } = useTheme();
  const { toasts } = useSession();
  const location = useLocation();
  const navType = useNavigationType();
  const [mobileSearch, setMobileSearch] = useState(false);

  // 새 화면은 맨 위부터 (뒤로 가기는 브라우저가 기억한 위치)
  useEffect(() => {
    if (navType !== 'POP') window.scrollTo(0, 0);
    setMobileSearch(false);
  }, [location.pathname, navType]);

  const ThemeIcon = dark ? Sun : Moon;
  const themeLabel = dark ? '밝은 화면으로' : '어두운 화면으로';

  return (
    <div className="shell">
      <a href="#main" className="skip-link">
        본문으로 건너뛰기
      </a>
      <aside className="sidenav" aria-label="주 메뉴">
        <Link to="/" className="brand">
          <Mark />
          <span>
            StockNews
            <span className="brand-sub">뉴스로 보는 종목</span>
          </span>
        </Link>
        <nav>
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Icon className="icon" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="nav-spacer" />
        <div className="nav-foot">
          <button type="button" className="nav-link" onClick={toggle}>
            <ThemeIcon className="icon" aria-hidden="true" />
            {themeLabel}
          </button>
          <a className="nav-link" href="/v7">
            <Newspaper className="icon" aria-hidden="true" />
            이전 화면(V7) 비교
          </a>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <Link to="/" className="mobile-brand" aria-label="StockNews 홈">
            <Mark />
            <span className="brand-text">StockNews</span>
          </Link>
          <SearchBox className="desktop-search" />
          <div className="topbar-right">
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
          <div className="mobile-search" role="dialog" aria-modal="true" aria-label="검색">
            <div className="mobile-search-head">
              <SearchBox autoFocus onDone={() => setMobileSearch(false)} placeholder="종목·뉴스 검색" />
              <button type="button" className="icon-btn" aria-label="검색 닫기" onClick={() => setMobileSearch(false)}>
                <X className="icon" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        <main id="main" className="content" tabIndex={-1}>
          <Outlet />
        </main>

        <footer className="footer">
          AI가 뉴스·공시를 읽고 종목과 연결한 정보예요. 틀릴 수 있고 투자 권유가 아니며, 투자 판단과 책임은 본인에게 있어요.
          <br />
          시세 한국투자증권(KIS) · 공시 금융감독원 전자공시(DART) · 차트 TradingView Lightweight Charts
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
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone === 'error' ? 'error' : ''}`} role={t.tone === 'error' ? 'alert' : 'status'}>
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
