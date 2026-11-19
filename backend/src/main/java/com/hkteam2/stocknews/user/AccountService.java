package com.hkteam2.stocknews.user;

import java.time.Clock;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hkteam2.stocknews.common.error.BusinessException;
import com.hkteam2.stocknews.common.error.ErrorCode;

/**
 * 계정 관리 (2026-11-18): 내 정보, 비밀번호 바꾸기, 확인 질문, 탈퇴, 비밀번호·아이디 찾기.
 * 비밀번호·답을 맞혀 보는 곳은 모두 LoginAttemptLimiter 로 10분에 5번까지 (넘으면 1분 잠금) (이름표를 달리해 로그인 기록과 섞이지 않게)
 * 한계: JWT 는 서버가 기억하지 않는 출입증이라, 비밀번호를 바꿔도 이미 나간 토큰은 만료(60분)까지 유효.
 *       탈퇴한 계정의 토큰은 /me 가 401 을 줘서 화면이 로그아웃함
 */
@Service
public class AccountService {

    /** 아이디 찾기에서 비밀번호를 맞춰 볼 계정 수 상한 (BCrypt 한 번에 약 0.1초) */
    private static final int FIND_CANDIDATES = 5;

    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final RecoveryAnswerHasher answerHasher;
    private final LoginAttemptLimiter limiter;
    // 11/19 계정 찾기 보안 보강: 접속 주소를 바꿔도 피할 수 없는 제한 (주소 자리에 ANY_IP). 메모리에 셈 (서버 한 대)
    /** 비밀번호 찾기: 계정 하나에 하루 10번 틀리면 하루 잠금 */
    private final LoginAttemptLimiter accountLimiter =
            new LoginAttemptLimiter(10, Duration.ofDays(1), Duration.ofDays(1), Clock.systemUTC());
    /**
     * 아이디 찾기: 서비스 전체에서 하루 20번 틀리면 그 뒤로 틀릴 때마다 1시간 잠금.
     * 잠금을 늘리지 않음(backoff=false): 모두가 함께 쓰는 제한이라, 늘리면 남이 하루 몇십 번 틀려 모두를 하루씩 막을 수 있음 (11/19 보안 검토)
     */
    private final LoginAttemptLimiter findIdLimiter =
            new LoginAttemptLimiter(20, Duration.ofDays(1), Duration.ofHours(1), false, Clock.systemUTC());
    /** 비밀번호 찾기 1단계(질문 보기): 접속 주소별로 10분에 '없음' 20번이면 10분 잠금 (가입자 목록 모으기 막기) */
    private final LoginAttemptLimiter askLimiter =
            new LoginAttemptLimiter(20, Duration.ofMinutes(10), Duration.ofMinutes(10), Clock.systemUTC());
    private static final String ANY_IP = "*";

    public AccountService(UserMapper userMapper, PasswordEncoder passwordEncoder, RecoveryAnswerHasher answerHasher,
                          LoginAttemptLimiter limiter) {
        this.userMapper = userMapper;
        this.passwordEncoder = passwordEncoder;
        this.answerHasher = answerHasher;
        this.limiter = limiter;
    }

    public List<AccountResponses.Question> questions() {
        return Arrays.stream(RecoveryQuestion.values()).map(AccountResponses.Question::of).toList();
    }

    @Transactional(readOnly = true)
    public MeResponse me(Long userId) {
        return MeResponse.from(load(userId), userMapper.countWatchlist(userId), userMapper.countPosts(userId),
                userMapper.countComments(userId));
    }

    @Transactional
    public void changePassword(Long userId, AccountRequests.ChangePassword req, String ip) {
        User user = checkPassword(userId, req.currentPassword(), ip);
        if (req.currentPassword().equals(req.newPassword())) {
            throw new BusinessException(ErrorCode.SAME_PASSWORD);
        }
        userMapper.updatePassword(user.getUserId(), passwordEncoder.encode(req.newPassword()));
    }

    @Transactional
    public MeResponse setRecovery(Long userId, AccountRequests.SetRecovery req, String ip) {
        RecoveryQuestion q = question(req.question());
        checkAnswer(req.answer());
        User user = checkPassword(userId, req.password(), ip);
        userMapper.updateRecovery(user.getUserId(), q.name(), answerHasher.hash(q, req.answer()));
        return me(userId);
    }

    /** 탈퇴: 관심 종목·쓴 글·댓글·공감을 지우고 회원을 지움 (한 트랜잭션, 되돌릴 수 없음) */
    @Transactional
    public void delete(Long userId, AccountRequests.DeleteAccount req, String ip) {
        Long id = checkPassword(userId, req.password(), ip).getUserId();
        userMapper.deleteLikesByUser(id);
        userMapper.deleteCommentsByUser(id);
        userMapper.deletePostsByUser(id);
        userMapper.deleteWatchlistByUser(id);
        userMapper.deleteById(id);
    }

    /** 비밀번호 찾기 1단계: 그 아이디의 질문 (없는 아이디·질문 안 정함은 같은 404) */
    /**
     * 비밀번호 찾기 1단계: 그 아이디의 질문 (없는 아이디·질문 안 정함은 같은 404)
     * 11/19 QA: 제한이 없어 아이디를 마구 넣어 가입자 목록을 모을 수 있었음 → 접속 주소별로 404(없음)를 세어 막음.
     * 질문이 나온 것은 세지 않음 (진짜 사용자는 보통 한두 번에 끝남)
     */
    @Transactional(readOnly = true)
    public AccountResponses.Question questionOf(String loginId, String ip) {
        Guard g = new Guard().with(askLimiter, "ask", ip).start();
        AccountResponses.Question q;
        try {
            q = userMapper.findByLoginId(loginId)
                    .flatMap(u -> RecoveryQuestion.of(u.getRecoveryQuestion()))
                    .map(AccountResponses.Question::of)
                    .orElse(null);
        } catch (RuntimeException e) {
            g.release();
            throw e;
        }
        if (q == null) {
            g.fail();
            throw new BusinessException(ErrorCode.RECOVERY_NOT_SET);
        }
        g.release();
        return q;
    }

    /**
     * 비밀번호 찾기 2단계: 답이 맞으면 새 비밀번호로 바꿈. 아이디+접속 주소별로 10분에 5번까지,
     * 그리고 접속 주소와 상관없이 계정 하나에 하루 10번까지 (11/19 보안 검토: 주소를 바꿔 가며 답을 맞혀 볼 수 있었음).
     * 한계: 남이 일부러 틀려 그 계정의 비밀번호 찾기를 하루 막을 수는 있음 (로그인은 막히지 않음)
     * 없는 아이디는 1단계와 같은 '없음' 횟수로 셈 (11/19 보안 검토: 아이디마다 새로 세는 제한이라 여기로 가입자 목록을 모을 수 있었음)
     */
    @Transactional
    public void resetPassword(AccountRequests.ResetPassword req, String ip) {
        String key = "reset:" + req.loginId();
        Guard ask = new Guard().with(askLimiter, "ask", ip).start();
        Guard g;
        try {
            g = new Guard().with(limiter, key, ip).with(accountLimiter, key, ANY_IP).start();
        } catch (RuntimeException e) {
            ask.release();
            throw e;
        }
        User user;
        boolean matches;
        try {
            user = userMapper.findByLoginId(req.loginId())
                    .filter(u -> RecoveryQuestion.of(u.getRecoveryQuestion()).isPresent())
                    .orElse(null);
            matches = user != null
                    && answerHasher.matches(question(user.getRecoveryQuestion()), req.answer(), user.getRecoveryAnswerHmac());
        } catch (RuntimeException e) {
            ask.release();
            g.release();
            throw e;
        }
        if (user == null) {
            ask.fail();
            g.release();
            throw new BusinessException(ErrorCode.RECOVERY_NOT_SET);
        }
        ask.release();
        if (!matches) {
            g.fail();
            throw new BusinessException(ErrorCode.RECOVERY_ANSWER_MISMATCH);
        }
        g.ok();
        userMapper.updatePassword(user.getUserId(), passwordEncoder.encode(req.newPassword()));
    }

    /**
     * 아이디 찾기: 질문·답이 같은 계정 중 비밀번호까지 맞는 것. 접속 주소별로 10분에 5번까지,
     * 그리고 서비스 전체에서 하루 20번 틀리면 그 뒤로는 틀릴 때마다 1시간 잠금
     * (11/19 보안 검토: 로그인 제한을 거치지 않고 비밀번호를 맞혀 보는 통로가 될 수 있음 → 주소를 바꿔도 전체 횟수가 묶임).
     * 한계: 누가 일부러 틀리면 모두의 아이디 찾기가 잠시 막힘 (드물게 쓰는 기능이라 받아들임)
     */
    @Transactional(readOnly = true)
    public AccountResponses.FoundLoginId findLoginId(AccountRequests.FindLoginId req, String ip) {
        String key = "find-id";
        RecoveryQuestion q = question(req.question());
        Guard g = new Guard().with(limiter, key, ip).with(findIdLimiter, key, ANY_IP).start();
        User found;
        try {
            String hmac = answerHasher.hash(q, req.answer());
            found = userMapper.findByRecovery(q.name(), hmac, FIND_CANDIDATES).stream()
                    .filter(u -> passwordEncoder.matches(req.password(), u.getPasswordHash()))
                    .findFirst()
                    .orElse(null);
        } catch (RuntimeException e) {
            g.release();
            throw e;
        }
        if (found == null) {
            g.fail();
            throw new BusinessException(ErrorCode.ACCOUNT_NOT_FOUND);
        }
        // 성공해도 센 것을 지우지 않음 (11/19 보안 검토: 공격자가 자기 계정으로 한 번 성공해 전체 횟수를 0 으로 돌릴 수 있었음)
        // → 틀린 수는 창(하루·10분)이 끝나야 사라짐
        g.release();
        return new AccountResponses.FoundLoginId(found.getLoginId());
    }

    /** 가입할 때 확인 질문도 줬으면 검사해서 User 에 담음 (둘 중 하나만 주면 400) */
    void applySignupRecovery(User user, String question, String answer) {
        boolean hasQ = question != null && !question.isBlank();
        boolean hasA = answer != null && !answer.isBlank();
        if (!hasQ && !hasA) {
            return;
        }
        if (hasQ != hasA) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST);
        }
        RecoveryQuestion q = question(question);
        checkAnswer(answer);
        user.setRecovery(q.name(), answerHasher.hash(q, answer));
    }

    private User load(Long userId) {
        // 탈퇴한 계정의 (아직 만료 전) 토큰 → 401 로 로그아웃시킴
        return userMapper.findById(userId).orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHORIZED));
    }

    /** 로그인한 채로 하는 중요한 일(비밀번호 바꾸기·질문·탈퇴) 전에 비밀번호를 다시 확인 */
    private User checkPassword(Long userId, String password, String ip) {
        String key = "confirm:" + userId;
        start(key, ip);
        User user;
        boolean matches;
        try {
            user = load(userId);
            matches = passwordEncoder.matches(password, user.getPasswordHash());
        } catch (RuntimeException e) {
            limiter.release(key, ip);
            throw e;
        }
        if (!matches) {
            limiter.onFailure(key, ip);
            throw new BusinessException(ErrorCode.WRONG_PASSWORD);
        }
        limiter.onSuccess(key, ip);
        return user;
    }

    /** 동시에 들어온 시도도 미리 셈 (로그인과 같은 기준). 끝나면 onFailure·onSuccess·release 중 하나를 꼭 부름 */
    private void start(String key, String ip) {
        if (!limiter.tryStart(key, ip)) {
            throw new BusinessException(ErrorCode.TOO_MANY_ATTEMPTS);
        }
    }

    private static RecoveryQuestion question(String code) {
        return RecoveryQuestion.of(code).orElseThrow(() -> new BusinessException(ErrorCode.INVALID_REQUEST));
    }

    /** 다듬은 뒤 빈 답(띄어쓰기만)은 받지 않음 */
    private static void checkAnswer(String answer) {
        if (RecoveryAnswerHasher.normalize(answer).isEmpty()) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST);
        }
    }

    /**
     * 제한기 여러 개를 한 번에: 모두 tryStart 를 통과해야 시작하고(하나라도 막히면 앞서 센 것을 되돌림),
     * 끝나면 모두에 같은 결과(fail·ok·release)를 알림
     */
    private static final class Guard {
        private record Slot(LoginAttemptLimiter limiter, String key, String ip) {
        }

        private final List<Slot> slots = new ArrayList<>();

        Guard with(LoginAttemptLimiter limiter, String key, String ip) {
            slots.add(new Slot(limiter, key, ip));
            return this;
        }

        Guard start() {
            for (int i = 0; i < slots.size(); i++) {
                Slot s = slots.get(i);
                if (!s.limiter().tryStart(s.key(), s.ip())) {
                    slots.subList(0, i).forEach(d -> d.limiter().release(d.key(), d.ip()));
                    throw new BusinessException(ErrorCode.TOO_MANY_ATTEMPTS);
                }
            }
            return this;
        }

        void fail() {
            slots.forEach(s -> s.limiter().onFailure(s.key(), s.ip()));
        }

        void ok() {
            slots.forEach(s -> s.limiter().onSuccess(s.key(), s.ip()));
        }

        void release() {
            slots.forEach(s -> s.limiter().release(s.key(), s.ip()));
        }
    }
}
