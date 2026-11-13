// 로그인 상태 · 관심 종목 · 알림(토스트)을 화면 전체가 같이 씀
// - 토큰은 api/client.js 의 tokenStore (localStorage). 401 이면 client 가 토큰을 지움 → 여기서도 로그아웃 상태로
// - 로그인이 필요한 동작은 requireLogin(이유) 로 로그인 창을 엶
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { authApi, tokenStore, watchlistApi } from '../../api';
import { errorText } from '../lib/errors';

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(() => Boolean(tokenStore.get()));
  const [authModal, setAuthModal] = useState(null); // { mode: 'login'|'signup', reason }
  const [watchlist, setWatchlist] = useState({ items: [], loaded: false, error: null });
  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);

  // action: { label, run } — 알림 안의 버튼 (예: 되돌리기). 버튼이 있으면 누를 시간을 주려고 더 오래 보임
  const toast = useCallback((message, tone = 'info', action = null) => {
    toastId.current += 1;
    const id = toastId.current;
    setToasts((list) => [...list.slice(-2), { id, message, tone, action }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), action ? 7000 : tone === 'error' ? 5000 : 3000);
  }, []);
  const dismissToast = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const loadWatchlist = useCallback(async () => {
    try {
      const res = await watchlistApi.list();
      setWatchlist({ items: res?.items || [], loaded: true, error: null });
    } catch (err) {
      setWatchlist((prev) => ({ ...prev, loaded: true, error: err }));
      if (err?.status === 401) setUser(null);
    }
  }, []);

  // 처음 열 때 저장된 토큰이 살아 있는지 확인
  useEffect(() => {
    if (!tokenStore.get()) return;
    const controller = new AbortController();
    authApi
      .me({ signal: controller.signal })
      .then((me) => setUser(me))
      .catch(() => setUser(null))
      .finally(() => setChecking(false));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (user) loadWatchlist();
    else setWatchlist({ items: [], loaded: false, error: null });
  }, [user, loadWatchlist]);

  const login = useCallback(async (loginId, password) => {
    await authApi.login(loginId, password);
    const me = await authApi.me();
    setUser(me);
    return me;
  }, []);

  const signup = useCallback(
    async (loginId, password) => {
      await authApi.signup(loginId, password);
      return login(loginId, password);
    },
    [login]
  );

  const logout = useCallback(() => {
    authApi.logout();
    setUser(null);
    toast('로그아웃했어요.');
  }, [toast]);

  // 로그인 뒤에 이어서 할 일 (11/13 사용자 눈으로: 별을 눌러 가입까지 했는데 돌아오니 안 담겨 있어 별을 또 눌러야 했음)
  const pendingRef = useRef(null);
  const requireLogin = useCallback((reason, then) => {
    pendingRef.current = then || null;
    setAuthModal({ mode: 'login', reason });
  }, []);
  useEffect(() => {
    if (!user || !pendingRef.current) return;
    const run = pendingRef.current;
    pendingRef.current = null;
    run();
  }, [user]);

  /** 로그인이 필요한 API 를 부르다 401 이 나면 로그아웃 상태로 돌리고 로그인 창 */
  const handleAuthError = useCallback(
    (err, reason) => {
      if (err?.status === 401) {
        setUser(null);
        setAuthModal({ mode: 'login', reason: reason || '로그인이 끝났어요. 다시 로그인해 주세요.' });
        return true;
      }
      return false;
    },
    []
  );

  const watchCodes = useMemo(() => new Set(watchlist.items.map((w) => w.stockCode)), [watchlist.items]);

  const toggleWatch = useCallback(
    async (stockCode, stockName) => {
      if (!user) {
        const name = stockName || stockCode;
        requireLogin('관심 종목은 로그인하면 저장돼요. 로그인하면 바로 담아 드려요.', async () => {
          try {
            await watchlistApi.add(stockCode);
            toast(`관심 종목에 담았어요 · ${name}`);
          } catch (err) {
            if (err?.status === 409) toast(`이미 관심 종목에 있어요 · ${name}`);
            else if (!handleAuthError(err)) toast(errorText(err), 'error');
          }
          await loadWatchlist();
        });
        return;
      }
      const has = watchCodes.has(stockCode);
      try {
        if (has) await watchlistApi.remove(stockCode);
        else await watchlistApi.add(stockCode);
        await loadWatchlist();
        const name = stockName || stockCode;
        if (has) {
          // 뺀 뒤 되돌리기 (11/12 코드 점검: 누르면 바로 지워지고 되돌릴 방법이 없었음)
          toast(`관심 종목에서 뺐어요 · ${name}`, 'info', {
            label: '되돌리기',
            run: async () => {
              try {
                await watchlistApi.add(stockCode);
                await loadWatchlist();
                toast(`다시 담았어요 · ${name}`);
              } catch (err) {
                if (!handleAuthError(err)) toast(errorText(err), 'error');
              }
            },
          });
        } else {
          toast(`관심 종목에 담았어요 · ${name}`);
        }
      } catch (err) {
        if (!handleAuthError(err)) toast(errorText(err), 'error');
      }
    },
    [user, watchCodes, loadWatchlist, toast, requireLogin, handleAuthError]
  );

  const value = useMemo(
    () => ({
      user,
      checking,
      login,
      signup,
      logout,
      authModal,
      openAuth: (mode = 'login', reason) => setAuthModal({ mode, reason }),
      closeAuth: () => {
        // 로그인하지 않고 닫을 때만 맡긴 일을 버림. user 값은 이 함수가 만들어진 때의 옛 값일 수 있어(로그인 직후 닫힘)
        // 로그인하면 바로 저장되는 토큰으로 판단
        if (!tokenStore.get()) pendingRef.current = null;
        setAuthModal(null);
      },
      requireLogin,
      handleAuthError,
      watchlist,
      watchCodes,
      reloadWatchlist: loadWatchlist,
      toggleWatch,
      toast,
      toasts,
      dismissToast,
    }),
    [user, checking, login, signup, logout, authModal, requireLogin, handleAuthError, watchlist, watchCodes, loadWatchlist, toggleWatch, toast, toasts, dismissToast]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('SessionProvider 안에서만 쓸 수 있어요');
  return ctx;
}
