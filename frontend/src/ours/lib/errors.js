// API 실패를 화면 문장으로. 서버가 준 message(사용자에게 보여 줘도 되는 한국어 문장, docs/api.md 1절)를 먼저 씀
import { ApiError } from '../../api';
import { hasFinal } from './josa';
import { isNetworkError } from './netStatus';

// 서버 문장은 '~습니다'(합니다체)라 화면의 해요체와 섞였음 → 자주 보이는 오류는 해요체로, '무슨 일 + 할 일' 순서로 (11/16 UX 라이팅 점검:
// NN/g 오류 메시지 지침·토스 UX 라이팅 — 해요체 통일, 사용자 탓으로 들리지 않게)
const CODE_TEXT = {
  STOCK_NOT_FOUND: '종목을 찾을 수 없어요. 이름이나 코드를 다시 확인해 주세요.',
  ARTICLE_NOT_FOUND: '글을 찾을 수 없어요. 지워졌거나 주소가 바뀌었을 수 있어요.',
  POST_NOT_FOUND: '글을 찾을 수 없어요. 이미 지워졌을 수 있어요.',
  COMMENT_NOT_FOUND: '댓글을 찾을 수 없어요. 이미 지워졌을 수 있어요.',
  NOT_POST_OWNER: '내가 쓴 글만 지울 수 있어요.',
  NOT_COMMENT_OWNER: '내가 쓴 댓글만 지울 수 있어요.',
  DUPLICATE_LOGIN_ID: '이미 쓰고 있는 아이디예요. 다른 아이디를 넣어 주세요.',
  INVALID_CREDENTIALS: '아이디나 비밀번호가 맞지 않아요. 다시 확인해 주세요.',
  // 서버 잠금: 10분 안에 5번 틀리면 1분, 또 틀리면 2·4·8분 (PR #131 LoginAttemptLimiter). 전엔 '10분 뒤'라고 적혀 실제와 달랐음
  TOO_MANY_LOGIN_ATTEMPTS: '로그인을 여러 번 실패해서 잠시 막았어요. 1분쯤 뒤에 다시 해 주세요. 계속 틀리면 기다리는 시간이 늘어나요.',
  ALREADY_IN_WATCHLIST: '이미 관심 종목에 담겨 있어요.',
  WATCHLIST_NOT_FOUND: '관심 종목에 없는 종목이에요.',
  AI_UNAVAILABLE: '요약 서버를 지금 쓸 수 없어요. 잠시 후 다시 해 주세요.',
  AI_BUSY: '요약 요청이 몰렸어요. 잠시 후 다시 해 주세요.',
  AI_NOT_CONFIGURED: '이 서버에서는 요약 다시 만들기를 쓸 수 없어요.',
  FORBIDDEN: '이 일을 할 권한이 없어요.',
  INTERNAL_ERROR: '서버에 문제가 생겼어요. 잠시 후 다시 해 주세요.',
  NOT_FOUND: '찾는 주소가 없어요.',
};

/** '~입니다/습니다/합니다' 로 끝나는 서버 문장을 해요체로 (입력값 검사 문장 등 목록에 없는 것) */
export function haeyo(msg) {
  return String(msg)
    .replace(/(\S+?)입니다([.!]?)/g, (_, w, p) => `${w}${hasFinal(w) ? '이에요' : '예요'}${p}`)
    .replace(/없습니다/g, '없어요')
    .replace(/있습니다/g, '있어요')
    .replace(/됩니다/g, '돼요')
    .replace(/했습니다/g, '했어요')
    .replace(/합니다/g, '해요')
    .replace(/않습니다/g, '않아요');
}

/** 상황별 문장. 서버 message 가 없을 때만 씀 */
export function errorText(err, fallback = '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.') {
  if (!err) return fallback;
  if (err instanceof ApiError) {
    if (err.status === 401 && err.code === 'UNAUTHORIZED') return '로그인이 필요해요. 다시 로그인해 주세요.';
    // 본문이 JSON 이 아닌 403 = 스프링 CORS 거절("Invalid CORS request")
    if (err.status === 403 && err.code === 'UNKNOWN') {
      return '서버가 이 화면 주소의 요청을 막았어요. 개발 서버 설정을 확인해 주세요.';
    }
    if (err.code === 'UNKNOWN' && err.status >= 500) return '서버에 문제가 생겼어요. 잠시 후 다시 시도해 주세요.';
    if (CODE_TEXT[err.code]) return CODE_TEXT[err.code];
    return err.message ? haeyo(err.message) : fallback;
  }
  // fetch 자체가 실패 (서버가 꺼져 있거나 네트워크 끊김)
  if (isNetworkError(err)) return '서버에 연결하지 못했어요. 인터넷 연결이나 서버 상태를 확인해 주세요.';
  return fallback;
}

/** 시세가 꺼진 서버(KIS_ENABLED=false)인가 */
export const isQuoteDisabled = (err) => err?.code === 'QUOTE_DISABLED';
