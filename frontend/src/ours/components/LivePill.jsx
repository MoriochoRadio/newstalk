// 수집 상태 알약 (V7 "실시간 매칭 · 시각"을 우리 말로): 살아 있으면 초록 점이 깜박, 멈췄으면 노랑
import { useStatus, isLive } from '../lib/useStatus';
import { relativeTime, shortTime } from '../lib/format';

export default function LivePill({ className = '' }) {
  const { data, error } = useStatus();
  if (error && !data) return null;
  if (!data) return <span className={`live-pill skeleton ${className}`} style={{ width: 150 }} aria-hidden="true" />;
  const live = isLive(data);
  const at = data.newsCollectedAt;
  return (
    <span
      className={`live-pill ${live ? 'on' : 'off'} ${className}`}
      title={`뉴스 수집 ${at ? shortTime(at) : '기록 없음'} · 종목 요약 ${data.summaryGeneratedAt ? shortTime(data.summaryGeneratedAt) : '기록 없음'}`}
    >
      <i aria-hidden="true" />
      {live ? `실시간 매칭 · ${shortTime(at)}` : at ? `업데이트 ${relativeTime(at)}` : '수집 기록 없음'}
    </span>
  );
}
