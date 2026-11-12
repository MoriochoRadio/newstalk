// 검색창 (자동완성). 종목은 이름·코드·별칭(삼전 → 삼성전자), 글은 제목·요약·키워드
// mode 'all': 종목 5 + 글 5 (GET /api/search), Enter 는 /search?q= 결과 화면
// mode 'stock': 종목만 (GET /api/stocks?q=), 고르면 onPick(stock)
import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Search, X } from 'lucide-react';
import { searchApi, stockApi } from '../../api';
import { toUiArticle } from '../../api/adapters';
import { useDebounced } from '../lib/hooks';
import { shortTime } from '../lib/format';
import { errorText } from '../lib/errors';

/** 검색어와 같은 부분을 굵게 */
function Highlight({ text, q }) {
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

export default function SearchBox({
  mode = 'all',
  placeholder = '종목·뉴스 검색 (예: 삼전, 005930, 반도체)…',
  onPick,
  autoFocus = false,
  onDone,
  className = '',
  label = '종목·뉴스 검색',
}) {
  const navigate = useNavigate();
  const listId = useId();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [res, setRes] = useState({ q: '', stocks: [], stockTotal: 0, articles: [], articleTotal: 0, error: null, loading: false });
  const debounced = useDebounced(q.trim(), 200);
  const boxRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!debounced || debounced.length > 50) return undefined;
    const controller = new AbortController();
    setRes((r) => ({ ...r, loading: true }));
    const call =
      mode === 'stock'
        ? stockApi.search(debounced, { size: 8 }, { signal: controller.signal }).then((d) => ({
            stocks: d.items || [],
            stockTotal: d.totalCount || 0,
            articles: [],
            articleTotal: 0,
          }))
        : searchApi.all(debounced, { size: 5 }, { signal: controller.signal }).then((d) => ({
            stocks: d.stocks?.items || [],
            stockTotal: d.stocks?.totalCount || 0,
            articles: (d.articles?.items || []).map(toUiArticle),
            articleTotal: d.articles?.totalCount || 0,
          }));
    call
      .then((d) => setRes({ q: debounced, ...d, error: null, loading: false }))
      .catch((err) => {
        if (err.name !== 'AbortError') setRes({ q: debounced, stocks: [], stockTotal: 0, articles: [], articleTotal: 0, error: err, loading: false });
      });
    return () => controller.abort();
  }, [debounced, mode]);

  // 바깥을 누르면 닫음
  useEffect(() => {
    const onDown = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, []);

  const fresh = res.q === debounced && debounced !== '';
  const options = fresh
    ? [
        ...res.stocks.map((s) => ({ type: 'stock', key: `s${s.stockCode}`, item: s })),
        ...res.articles.map((a) => ({ type: 'article', key: `a${a.id}`, item: a })),
      ]
    : [];

  const finish = () => {
    setOpen(false);
    setActive(-1);
    setQ('');
    onDone?.();
  };

  const choose = (opt) => {
    if (opt.type === 'stock') {
      if (onPick) onPick(opt.item);
      else navigate(`/stocks/${opt.item.stockCode}`);
    } else {
      navigate(`/news/${opt.item.id}`);
    }
    finish();
  };

  const submit = () => {
    const text = q.trim();
    if (!text) return;
    if (active >= 0 && options[active]) {
      choose(options[active]);
      return;
    }
    if (mode === 'stock') {
      if (options[0]) choose(options[0]);
      return;
    }
    navigate(`/search?q=${encodeURIComponent(text)}`);
    finish();
  };

  const onKey = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(-1, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActive(-1);
    }
  };

  const showPop = open && debounced !== '';
  const stockCount = fresh ? res.stocks.length : 0;

  return (
    <div className={`search ${className}`} ref={boxRef}>
      <div className="search-box">
        <Search className="icon" aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          autoComplete="off"
          role="combobox"
          aria-label={label}
          aria-expanded={showPop}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 && options[active] ? `${listId}-${options[active].key}` : undefined}
          placeholder={placeholder}
          value={q}
          maxLength={50}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
        />
        {q && (
          <button
            type="button"
            className="icon-btn"
            style={{ width: 32, height: 32 }}
            aria-label="검색어 지우기"
            onClick={() => {
              setQ('');
              inputRef.current?.focus(); // 버튼이 사라져도 포커스가 맨 위로 떨어지지 않게
            }}
          >
            <X className="icon-sm" aria-hidden="true" />
          </button>
        )}
      </div>
      {showPop && (
        // 11/12 접근성 점검: listbox 안에는 선택지와 묶음(group)만 — 로딩·안내 글과 '모두 보기' 버튼은 목록 밖
        <div className="search-pop">
          {!fresh && (
            <div role="status" style={{ padding: 8 }}>
              <span className="sr-only">찾는 중…</span>
              <div className="skeleton sk-line" style={{ width: '60%' }} />
              <div className="skeleton sk-line" style={{ width: '40%' }} />
            </div>
          )}
          {fresh && res.error && <p className="search-group" style={{ color: 'var(--danger)' }}>{errorText(res.error)}</p>}
          {fresh && !res.error && options.length === 0 && (
            <p role="status" style={{ padding: 12, color: 'var(--text-2)' }}>
              ‘{debounced}’와 맞는 {mode === 'stock' ? '종목이' : '종목·뉴스가'} 없어요.
            </p>
          )}
          <div id={listId} role="listbox" aria-label="검색 결과">
            {[
              { kind: 'stock', title: stockCount > 0 ? `종목 ${res.stockTotal > stockCount ? `${res.stockTotal}개 중 ${stockCount}` : stockCount}` : '' },
              { kind: 'article', title: fresh && res.articleTotal != null ? `뉴스·공시 ${res.articleTotal.toLocaleString('ko-KR')}건` : '' },
            ].map((g) => {
              const items = options.map((opt, i) => ({ opt, i })).filter(({ opt }) => opt.type === g.kind);
              if (!items.length) return null;
              const gid = `${listId}-g-${g.kind}`;
              return (
                <div key={g.kind} role="group" aria-labelledby={gid}>
                  <p className="search-group" id={gid} role="presentation">
                    {g.title}
                  </p>
                  {items.map(({ opt, i }) => (
                    <div
                      key={opt.key}
                      id={`${listId}-${opt.key}`}
                      role="option"
                      aria-selected={active === i}
                      className="search-opt"
                      onPointerDown={(e) => e.preventDefault()}
                      onClick={() => choose(opt)}
                      onMouseEnter={() => setActive(i)}
                    >
                      {opt.type === 'stock' ? (
                        <div className="opt-main">
                          <div className="opt-title">
                            <Highlight text={opt.item.stockName} q={debounced} />
                          </div>
                          <div className="opt-sub num">
                            {opt.item.stockCode} · {opt.item.market || '시장 정보 없음'}
                            {opt.item.matchedTheme ? ` · 테마: ${opt.item.matchedTheme}` : ''}
                          </div>
                        </div>
                      ) : (
                        <>
                          <FileText className="icon-sm muted" aria-hidden="true" />
                          <div className="opt-main">
                            <div className="opt-title">
                              <Highlight text={opt.item.title} q={debounced} />
                            </div>
                            <div className="opt-sub">
                              {opt.item.isDisclosure ? '전자공시' : opt.item.press} · {shortTime(opt.item.publishedAtIso)}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
          {mode === 'all' && fresh && !res.error && (
            <button
              type="button"
              className="search-foot"
              style={{ width: '100%', textAlign: 'left' }}
              onClick={() => {
                navigate(`/search?q=${encodeURIComponent(debounced)}`);
                finish();
              }}
            >
              ‘{debounced}’ 검색 결과 모두 보기
            </button>
          )}
        </div>
      )}
    </div>
  );
}
