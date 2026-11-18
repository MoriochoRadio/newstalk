import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { useTitle } from '../lib/hooks';
import { Empty } from '../components/ui';

export default function NotFoundPage() {
  useTitle('없는 화면');
  return (
    <div className="card" style={{ marginTop: 16 }}>
      {/* 화면 낭독기가 화면 이름을 알게 (11/13 QA: 이 화면만 제목이 없었음) */}
      <h1 className="sr-only">없는 화면</h1>
      <Empty
        icon={Compass}
        title="없는 화면이에요"
        desc="주소가 바뀌었거나 잘못 입력했을 수 있어요."
        action={
          <Link to="/" className="btn btn-primary btn-sm">
            홈으로
          </Link>
        }
      />
    </div>
  );
}
