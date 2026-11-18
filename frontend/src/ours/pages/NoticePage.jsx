// 이용 안내·유의사항 (11/18 사용자: 화면 맨 아래 면책 세 줄로는 부족, 다른 사이트처럼 잘 안 보이지만 늘 있는 '소비자 유의사항' 화면)
// 맨 아래(footer) 작은 링크로 들어옴. 읽는 화면이라 목차(넓은 화면은 왼쪽에 고정) + 짧은 절. 숫자·기준은 실제 동작과 같게 (바뀌면 같이 고침)
import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTitle } from '../lib/hooks';

const UPDATED = '2026년 11월 18일';

const SECTIONS = [
  { id: 'about', title: '이 서비스는' },
  { id: 'ai', title: 'AI가 만든 정보' },
  { id: 'price', title: '시세와 차트' },
  { id: 'source', title: '뉴스·공시 출처와 저작권' },
  { id: 'board', title: '종목 토론 이용 규칙' },
  { id: 'privacy', title: '개인정보 처리' },
  { id: 'account', title: '계정과 탈퇴' },
  { id: 'limit', title: '책임의 한계' },
];

export default function NoticePage() {
  useTitle('이용 안내·유의사항');
  const { hash } = useLocation();
  // 주소에 #privacy 처럼 절 이름이 있으면 그 절로 (가입 창·내 계정의 링크)
  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(hash.slice(1));
    if (el) requestAnimationFrame(() => el.scrollIntoView({ block: 'start' }));
  }, [hash]);

  return (
    <div className="notice">
      <div className="page-head">
        <div>
          <h1 className="page-title">이용 안내·유의사항</h1>
          <p className="page-sub">투자 판단에 쓰기 전에 꼭 읽어 주세요. 고친 날 {UPDATED}</p>
        </div>
      </div>

      <div className="notice-grid">
        <nav className="notice-toc card" aria-label="이용 안내 목차">
          <ol>
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.title}</a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="notice-body card">
          <p className="notice-lead">
            뉴스톡은 뉴스·공시가 <b>어떤 종목과, 왜</b> 이어지는지 AI로 정리해 보여 주는 정보 서비스예요. 매수·매도를 권하지 않고,
            주가를 예측하지 않아요. <b>투자 판단과 그 결과의 책임은 투자자 본인에게 있어요.</b>
          </p>

          <section id="about" aria-labelledby="about-t">
            <h2 id="about-t">이 서비스는</h2>
            <ul>
              <li>한경닷컴 IT교육센터 금융 과정의 팀 프로젝트로 만든 시연용 서비스예요. 금융투자업(투자자문·투자일임) 등록을 하지 않았고, 매매 기능도 없어요.</li>
              <li>뉴스는 약 5분마다 모으고, 종목별 종합 요약은 1시간마다 새로 만들어요. 그사이에 나온 소식은 아직 반영되지 않았을 수 있어요.</li>
              <li>화면의 순위(오늘 화제 종목 등)는 기사 수로 센 것이에요. 좋은 종목이라는 뜻이 아니에요.</li>
            </ul>
          </section>

          <section id="ai" aria-labelledby="ai-t">
            <h2 id="ai-t">AI가 만든 정보</h2>
            <p>
              기사 요약, 좋은·나쁜 소식·중립 판단, 기사와 종목의 연결, 종목 종합 요약은 <b>생성형 AI(OpenAI)</b>가 기사·공시 글을 읽고
              만든 것이에요. AI는 문장을 잘못 읽거나 없는 내용을 지어낼 수 있어요. 중요한 내용은 원문 링크로 꼭 확인해 주세요.
            </p>
            <dl className="notice-dl">
              <div>
                <dt>좋은 소식 · 나쁜 소식 · 중립</dt>
                <dd>기사 문장이 그 회사에 좋은 쪽인지 나쁜 쪽인지 AI가 나눈 거예요. 주가가 오르거나 내린다는 예측이 아니에요.</dd>
              </div>
              <div>
                <dt>주인공 · 함께 언급</dt>
                <dd>기사가 주로 다루는 회사는 주인공, 지나가며 이름만 나온 회사는 함께 언급이에요.</dd>
              </div>
              <div>
                <dt>AI 추정</dt>
                <dd>기사에 회사 이름이 없는데 사건이 영향을 줄 수 있다고 AI가 추정해 이은 종목이에요. 이름으로 이은 것보다 틀릴 가능성이 커요.</dd>
              </div>
              <div>
                <dt>제목만 연결</dt>
                <dd>‘AI 학습 및 활용 금지’를 밝힌 언론사 기사나 본문을 받지 못한 기사는 AI 요약·판단 없이 제목에 나온 회사 이름으로만 종목을 찾았어요.</dd>
              </div>
              <div>
                <dt>AI 요약 다시 만들기</dt>
                <dd>종목 화면에서 로그인하면 그날 기사로 요약을 새로 만들 수 있어요. 비용 때문에 같은 종목은 10분에 한 번만 새로 만들어요.</dd>
              </div>
            </dl>
          </section>

          <section id="price" aria-labelledby="price-t">
            <h2 id="price-t">시세와 차트</h2>
            <ul>
              <li>현재가·차트는 한국투자증권(KIS) Open API로 받아요. 받는 과정에서 늦거나 빠질 수 있고, 거래소 공식 시세를 대신하지 않아요.</li>
              <li>등락률은 직전 거래일 종가와 비교한 값이에요.</li>
              <li>시세와 기사를 나란히 보여 줄 뿐, 그 기사 때문에 주가가 움직였다는 뜻이 아니에요.</li>
              <li>장 시간은 평일 09:00~15:30이에요. 수능일처럼 개장이 늦춰지는 날은 따로 맞췄지만, 공휴일은 반영하지 못할 수 있어요.</li>
            </ul>
          </section>

          <section id="source" aria-labelledby="source-t">
            <h2 id="source-t">뉴스·공시 출처와 저작권</h2>
            <ul>
              <li>뉴스는 각 언론사가 공개한 RSS로 받아요. 기사의 저작권은 각 언론사에 있고, 화면에는 제목·AI 요약과 원문 링크만 보여 드려요.</li>
              <li>기사 본문은 요약을 만들 때만 쓰고 7일이 지나면 지워요. 화면과 API로는 내보내지 않아요.</li>
              <li>공시는 금융감독원 전자공시시스템(DART)에서 받아요. 공시의 정확한 내용은 DART 원문으로 확인해 주세요.</li>
              <li>
                차트는{' '}
                <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">
                  TradingView Lightweight Charts™
                </a>
                로 그려요.
              </li>
            </ul>
          </section>

          <section id="board" aria-labelledby="board-t">
            <h2 id="board-t">종목 토론 이용 규칙</h2>
            <p>아래 글은 알리지 않고 지울 수 있어요.</p>
            <ul>
              <li>확인되지 않은 소문이나 거짓 정보를 퍼뜨리는 글</li>
              <li>특정 종목을 사거나 팔라고 부추기는 글, 리딩방·유료 회원 모집 같은 홍보</li>
              <li>욕설·차별·다른 사람의 개인정보가 담긴 글</li>
            </ul>
            <p className="notice-fine">
              풍문을 퍼뜨리거나 거짓 정보로 시세에 영향을 주려는 행위는 자본시장법(제176조 시세조종, 제178조 부정거래행위)에 따라 처벌받을 수 있어요.
            </p>
          </section>

          <section id="privacy" aria-labelledby="privacy-t">
            <h2 id="privacy-t">개인정보 처리</h2>
            <table className="notice-table">
              <caption className="sr-only">저장하는 정보와 목적</caption>
              <thead>
                <tr>
                  <th scope="col">저장하는 것</th>
                  <th scope="col">왜</th>
                  <th scope="col">언제까지</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>아이디, 비밀번호(BCrypt로 암호화, 원래 값은 저장하지 않음)</td>
                  <td>로그인</td>
                  <td>탈퇴할 때까지</td>
                </tr>
                <tr>
                  <td>확인 질문 종류, 답의 암호값(HMAC, 답 원문은 저장하지 않음)</td>
                  <td>비밀번호·아이디 찾기 (정한 사람만)</td>
                  <td>탈퇴할 때까지</td>
                </tr>
                <tr>
                  <td>관심 종목, 종목 토론의 글·댓글·공감</td>
                  <td>서비스 기능</td>
                  <td>지우거나 탈퇴할 때까지</td>
                </tr>
                <tr>
                  <td>로그인·확인 질문을 틀린 횟수와 접속 주소(IP)</td>
                  <td>남이 비밀번호를 계속 넣어 보는 것 막기 (10분에 5번)</td>
                  <td>서버 메모리에만 약 10분</td>
                </tr>
              </tbody>
            </table>
            <ul>
              <li>이메일·휴대폰 번호·실명은 받지 않아요. 회원 정보는 다른 곳에 주지 않고, AI(OpenAI)에도 보내지 않아요. AI에는 기사·공시 글만 보내요.</li>
              <li>내 브라우저에는 로그인 토큰(60분 동안 유효)과 화면 설정(밝기, 메뉴 접기, 목록 보기 방식)을 저장해요. 로그아웃하면 토큰은 지워져요.</li>
            </ul>
          </section>

          <section id="account" aria-labelledby="account-t">
            <h2 id="account-t">계정과 탈퇴</h2>
            <ul>
              <li>
                연락처를 받지 않아서, <b>확인 질문을 정하지 않으면 비밀번호를 잊었을 때 되찾을 수 없어요.</b>{' '}
                <Link to="/account" className="link">
                  내 계정
                </Link>
                에서 정해 두세요.
              </li>
              <li>탈퇴하면 관심 종목과 쓴 글·댓글·공감이 바로 함께 지워지고 되돌릴 수 없어요. 내 글에 남이 단 댓글도 같이 지워져요.</li>
              <li>비밀번호를 바꿔도 이미 로그인한 다른 기기는 토큰이 끝날 때(최대 60분)까지 로그인 상태로 남을 수 있어요.</li>
            </ul>
          </section>

          <section id="limit" aria-labelledby="limit-t">
            <h2 id="limit-t">책임의 한계</h2>
            <ul>
              <li>보여 드리는 정보가 정확하고 빠짐없다고 보장하지 않아요. 외부 데이터(언론사, KIS, DART, OpenAI) 사정으로 늦거나 멈출 수 있어요.</li>
              <li>이 서비스의 정보를 보고 한 투자의 결과에 대해 책임지지 않아요. 투자 전에 원문과 공식 자료를 확인해 주세요.</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
