// 그리다 난 오류가 앱 전체를 빈 화면으로 만들지 않게 (11/16 코드 리뷰: 오류 경계가 하나도 없었음)
// 화면 단위(Shell 의 Outlet)와 차트 단위(종목 화면)에 씀. 화면 파일을 못 받은 경우(배포 뒤 옛 파일·순간 끊김)는 새로 고침을 권함
import { Component } from 'react';
import { RefreshCw } from 'lucide-react';

const isChunkError = (err) => /Loading chunk|dynamically imported module|Importing a module script failed/i.test(String(err?.message || err));

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // 개발 중 원인 찾기용 (화면에는 쉬운 문장만)
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const chunk = isChunkError(error);
    const { compact = false, label = '이 화면' } = this.props;
    return (
      <div className={compact ? 'error-box' : 'card error-screen'} role="alert">
        <p style={{ margin: 0 }}>
          {chunk ? '새 버전이 올라와 화면 파일을 다시 받아야 해요.' : `${label}을 그리지 못했어요.`} 다시 시도해 주세요.
        </p>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => (chunk ? window.location.reload() : this.setState({ error: null }))}
        >
          <RefreshCw className="icon-sm" aria-hidden="true" />
          {chunk ? '새로 고침' : '다시 시도'}
        </button>
      </div>
    );
  }
}
