// 분류별 보기 (11/18 사용자: 뉴스·공시 탭처럼 시장·업종·테마도 눌러서 골라 보기)
// 시장 = 코스피·코스닥, 업종·테마 = 우리가 정리한 테마 37개(반도체·바이오·증권·방산 …). KIND 업종명 158개는 '전동기, 발전기 및 …'처럼
// 길어서 고르기 어려움 → 테마로 (백엔드 StockCategory). 테마는 오늘 기사 많은 순, 처음엔 10개 + '더 보기'
// 값은 주소(?market=&theme=)에 둬서 뒤로 가기·공유가 됨 — 상태는 부르는 화면이 가짐
import { useState } from 'react';
import { X } from 'lucide-react';
import { stockApi } from '../../api';
import { useApi } from '../../hooks/useApi';
import { Segmented } from './ui';

export const MARKETS = [
  { key: '', label: '전체 시장' },
  { key: 'KOSPI', label: '코스피' },
  { key: 'KOSDAQ', label: '코스닥' },
];
const FIRST = 10;

/** value: { market, theme } ('' = 전체), onChange(next) 는 바뀐 칸만 */
export default function CategoryBar({ value, onChange, period = 'today', countLabel = '오늘 기사' }) {
  const themes = useApi((signal) => stockApi.themes(period, { signal }), [period]);
  const [more, setMore] = useState(false);
  const all = themes.data?.items || [];
  const withNews = all.filter((t) => t.articleCount > 0);
  // 고른 테마가 처음 10개 밖이어도 늘 보이게
  const base = more ? all : withNews.slice(0, FIRST);
  const shown = value.theme && !base.some((t) => t.theme === value.theme) ? [...base, all.find((t) => t.theme === value.theme) || { theme: value.theme, articleCount: 0 }] : base;
  const hidden = all.length - base.length;

  return (
    <div className="cat-bar">
      <div className="cat-row">
        <span className="cat-k" id="cat-market">
          시장
        </span>
        <Segmented label="시장" size="sm" options={MARKETS} value={value.market || ''} onChange={(k) => onChange({ market: k })} />
      </div>
      <div className="cat-row cat-row-themes">
        <span className="cat-k" id="cat-theme">
          업종·테마
        </span>
        <div className="cat-chips" role="group" aria-labelledby="cat-theme">
          <button type="button" className="cat-chip" aria-pressed={!value.theme} onClick={() => onChange({ theme: '' })}>
            전체
          </button>
          {themes.loading && !themes.data && <span className="skeleton" style={{ width: 220, height: 28, borderRadius: 999 }} />}
          {shown.map((t) => (
            <button
              key={t.theme}
              type="button"
              className={`cat-chip ${t.articleCount ? '' : 'is-empty'}`}
              aria-pressed={value.theme === t.theme}
              title={`${t.theme} 종목 ${t.stockCount ?? '-'}개 · ${countLabel} ${t.articleCount}건`}
              onClick={() => onChange({ theme: value.theme === t.theme ? '' : t.theme })}
            >
              {t.theme}
              <span className="cat-n num">{t.articleCount}</span>
            </button>
          ))}
          {!more && hidden > 0 && (
            <button type="button" className="cat-more" onClick={() => setMore(true)}>
              {hidden}개 더 보기
            </button>
          )}
          {more && (
            <button type="button" className="cat-more" onClick={() => setMore(false)}>
              접기
            </button>
          )}
        </div>
      </div>
      {(value.market || value.theme) && (
        <p className="cat-active" role="status">
          <span>
            {[MARKETS.find((m) => m.key === value.market)?.label, value.theme && `‘${value.theme}’ 테마`].filter((x) => x && x !== '전체 시장').join(' · ')} 종목이
            나온 것만 보고 있어요
          </span>
          <button type="button" className="link-btn" onClick={() => onChange({ market: '', theme: '' })}>
            <X className="icon-sm" aria-hidden="true" />
            분류 지우기
          </button>
        </p>
      )}
    </div>
  );
}
