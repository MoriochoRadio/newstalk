// API 실패를 화면 문장으로. 서버가 준 message(사용자에게 보여 줘도 되는 한국어 문장, docs/api.md 1절)를 먼저 씀
import { ApiError } from '../../api';

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
    return err.message || fallback;
  }
  // fetch 자체가 실패 (서버가 꺼져 있거나 네트워크 끊김)
  if (err instanceof TypeError) return '서버에 연결하지 못했어요. 인터넷 연결이나 서버 상태를 확인해 주세요.';
  return fallback;
}

/** 시세가 꺼진 서버(KIS_ENABLED=false)인가 */
export const isQuoteDisabled = (err) => err?.code === 'QUOTE_DISABLED';
