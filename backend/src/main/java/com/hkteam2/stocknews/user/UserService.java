package com.hkteam2.stocknews.user;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hkteam2.stocknews.common.error.BusinessException;
import com.hkteam2.stocknews.common.error.ErrorCode;

@Service
public class UserService {

    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final LoginAttemptLimiter loginLimiter;
    /** 없는 아이디일 때도 BCrypt 비교를 한 번 돌리기 위한 가짜 해시 (응답 시간으로 아이디가 있는지 알 수 없게) */
    private final String dummyHash;
    private final AccountService accountService;

    public UserService(UserMapper userMapper, PasswordEncoder passwordEncoder, JwtTokenProvider jwtTokenProvider,
                       LoginAttemptLimiter loginLimiter, AccountService accountService) {
        this.userMapper = userMapper;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenProvider = jwtTokenProvider;
        this.loginLimiter = loginLimiter;
        this.dummyHash = passwordEncoder.encode("dummy-password-for-timing");
        this.accountService = accountService;
    }

    @Transactional
    public SignupResponse signup(SignupRequest request) {
        if (userMapper.existsByLoginId(request.loginId())) {
            throw new BusinessException(ErrorCode.DUPLICATE_LOGIN_ID);
        }

        User user = User.newUser(request.loginId(), passwordEncoder.encode(request.password()));
        accountService.applySignupRecovery(user, request.recoveryQuestion(), request.recoveryAnswer()); // 선택
        try {
            userMapper.insert(user);
        } catch (DuplicateKeyException e) {
            // 두 사람이 같은 아이디로 동시에 가입하면 위 확인을 둘 다 통과할 수 있음 -> DB UNIQUE가 최종으로 막음
            throw new BusinessException(ErrorCode.DUPLICATE_LOGIN_ID);
        }
        return new SignupResponse(user.getUserId(), user.getLoginId());
    }

    @Transactional(readOnly = true)
    public LoginResponse login(LoginRequest request, String clientIp) {
        // 막혀 있으면 비밀번호를 보지도 않음 (맞는 비밀번호여도 막힘이 풀릴 때까지 기다려야 함)
        // 동시에 들어온 시도도 미리 셈 (11/18: 확인 뒤 검사라 동시 50번이면 50번 모두 BCrypt 를 돌았음)
        if (!loginLimiter.tryStart(request.loginId(), clientIp)) {
            throw new BusinessException(ErrorCode.TOO_MANY_LOGIN_ATTEMPTS);
        }
        User found;
        boolean matches;
        try {
            found = userMapper.findByLoginId(request.loginId()).orElse(null);
            // 없는 아이디도 같은 BCrypt 비교를 거침 → 있을 때와 응답 시간이 같아짐
            matches = passwordEncoder.matches(request.password(), found == null ? dummyHash : found.getPasswordHash());
        } catch (RuntimeException e) {
            loginLimiter.release(request.loginId(), clientIp); // DB 오류 등: 틀린 것으로 세지 않음
            throw e;
        }
        User user = matches ? found : null;
        if (user == null) {
            loginLimiter.onFailure(request.loginId(), clientIp); // 없는 아이디도 똑같이 셈 (아이디가 있는지 숨김)
            throw new BusinessException(ErrorCode.INVALID_CREDENTIALS);
        }
        loginLimiter.onSuccess(request.loginId(), clientIp);

        String token = jwtTokenProvider.createToken(user);
        return LoginResponse.bearer(token, jwtTokenProvider.getExpirationSeconds());
    }
}
