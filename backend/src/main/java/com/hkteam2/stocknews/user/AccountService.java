package com.hkteam2.stocknews.user;

import java.util.Arrays;
import java.util.List;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hkteam2.stocknews.common.error.BusinessException;
import com.hkteam2.stocknews.common.error.ErrorCode;

/**
 * 계정 관리 (2026-11-18): 내 정보, 비밀번호 바꾸기, 확인 질문, 탈퇴, 비밀번호·아이디 찾기.
 * 비밀번호·답을 맞혀 보는 곳은 모두 LoginAttemptLimiter 로 10분에 5번까지 (이름표를 달리해 로그인 기록과 섞이지 않게)
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
        return MeResponse.from(load(userId));
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
    @Transactional(readOnly = true)
    public AccountResponses.Question questionOf(String loginId) {
        return userMapper.findByLoginId(loginId)
                .flatMap(u -> RecoveryQuestion.of(u.getRecoveryQuestion()))
                .map(AccountResponses.Question::of)
                .orElseThrow(() -> new BusinessException(ErrorCode.RECOVERY_NOT_SET));
    }

    /** 비밀번호 찾기 2단계: 답이 맞으면 새 비밀번호로 바꿈. 아이디+접속 주소별로 10분에 5번까지 */
    @Transactional
    public void resetPassword(AccountRequests.ResetPassword req, String ip) {
        String key = "reset:" + req.loginId();
        if (limiter.isLocked(key, ip)) {
            throw new BusinessException(ErrorCode.TOO_MANY_ATTEMPTS);
        }
        User user = userMapper.findByLoginId(req.loginId())
                .filter(u -> RecoveryQuestion.of(u.getRecoveryQuestion()).isPresent())
                .orElseThrow(() -> new BusinessException(ErrorCode.RECOVERY_NOT_SET));
        RecoveryQuestion q = question(user.getRecoveryQuestion());
        if (!answerHasher.matches(q, req.answer(), user.getRecoveryAnswerHmac())) {
            limiter.onFailure(key, ip);
            throw new BusinessException(ErrorCode.RECOVERY_ANSWER_MISMATCH);
        }
        limiter.onSuccess(key, ip);
        userMapper.updatePassword(user.getUserId(), passwordEncoder.encode(req.newPassword()));
    }

    /** 아이디 찾기: 질문·답이 같은 계정 중 비밀번호까지 맞는 것. 접속 주소별로 10분에 5번까지 */
    @Transactional(readOnly = true)
    public AccountResponses.FoundLoginId findLoginId(AccountRequests.FindLoginId req, String ip) {
        String key = "find-id";
        if (limiter.isLocked(key, ip)) {
            throw new BusinessException(ErrorCode.TOO_MANY_ATTEMPTS);
        }
        RecoveryQuestion q = question(req.question());
        String hmac = answerHasher.hash(q, req.answer());
        User found = userMapper.findByRecovery(q.name(), hmac, FIND_CANDIDATES).stream()
                .filter(u -> passwordEncoder.matches(req.password(), u.getPasswordHash()))
                .findFirst()
                .orElse(null);
        if (found == null) {
            limiter.onFailure(key, ip);
            throw new BusinessException(ErrorCode.ACCOUNT_NOT_FOUND);
        }
        limiter.onSuccess(key, ip);
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
        if (limiter.isLocked(key, ip)) {
            throw new BusinessException(ErrorCode.TOO_MANY_ATTEMPTS);
        }
        User user = load(userId);
        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            limiter.onFailure(key, ip);
            throw new BusinessException(ErrorCode.WRONG_PASSWORD);
        }
        limiter.onSuccess(key, ip);
        return user;
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
}
