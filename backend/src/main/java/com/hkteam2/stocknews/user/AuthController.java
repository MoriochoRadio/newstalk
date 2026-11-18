package com.hkteam2.stocknews.user;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.hkteam2.stocknews.common.config.OpenApiConfig;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

@Tag(name = "회원", description = "회원가입·로그인·내 계정 (비밀번호 바꾸기·확인 질문·탈퇴·비밀번호/아이디 찾기)")
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserService userService;
    private final AccountService accountService;

    public AuthController(UserService userService, AccountService accountService) {
        this.userService = userService;
        this.accountService = accountService;
    }

    @Operation(summary = "회원가입", description = "아이디가 이미 있으면 409 DUPLICATE_LOGIN_ID, 규칙에 어긋나면 400 INVALID_REQUEST."
            + " 확인 질문(recoveryQuestion·recoveryAnswer)은 선택, 하나만 주면 400")
    @PostMapping("/signup")
    @ResponseStatus(HttpStatus.CREATED)
    public SignupResponse signup(@Valid @RequestBody SignupRequest request) {
        return userService.signup(request);
    }

    @Operation(summary = "로그인", description = "성공하면 JWT를 발급합니다. 아이디나 비밀번호가 틀리면 401 INVALID_CREDENTIALS. "
            + "같은 아이디·같은 곳에서 10분 안에 5번 틀리면 10분 동안 429 TOO_MANY_LOGIN_ATTEMPTS")
    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest request, HttpServletRequest http) {
        // 프록시 없이 바로 받으므로 접속한 주소를 그대로 씀 (X-Forwarded-For 는 누구나 꾸밀 수 있어 믿지 않음)
        return userService.login(request, http.getRemoteAddr());
    }

    /** Security가 토큰 검사를 통과시킨 경우에만 들어옴. jwt = 검사가 끝난 토큰 내용 */
    @Operation(summary = "내 정보", description = "토큰이 없거나 만료·위조되면, 또는 탈퇴한 계정이면 401 UNAUTHORIZED."
            + " recoveryQuestion = 정한 확인 질문 {code, text} (안 정했으면 null)",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH))
    @GetMapping("/me")
    public MeResponse me(@AuthenticationPrincipal Jwt jwt) {
        return accountService.me(userIdOf(jwt));
    }

    @Operation(summary = "비밀번호 바꾸기", description = "지금 비밀번호가 틀리면 400 WRONG_PASSWORD, 같은 비밀번호면 400 SAME_PASSWORD."
            + " 10분 안에 5번 틀리면 429 TOO_MANY_ATTEMPTS",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH))
    @PutMapping("/me/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void changePassword(@AuthenticationPrincipal Jwt jwt,
                               @Valid @RequestBody AccountRequests.ChangePassword request, HttpServletRequest http) {
        accountService.changePassword(userIdOf(jwt), request, http.getRemoteAddr());
    }

    @Operation(summary = "확인 질문 정하기·바꾸기", description = "비밀번호를 잊었을 때 쓸 질문과 답. 답은 원문을 저장하지 않음."
            + " 비밀번호가 틀리면 400 WRONG_PASSWORD, 없는 질문 코드면 400 INVALID_REQUEST",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH))
    @PutMapping("/me/recovery")
    public MeResponse setRecovery(@AuthenticationPrincipal Jwt jwt,
                                  @Valid @RequestBody AccountRequests.SetRecovery request, HttpServletRequest http) {
        return accountService.setRecovery(userIdOf(jwt), request, http.getRemoteAddr());
    }

    @Operation(summary = "탈퇴", description = "비밀번호를 한 번 더 받고, 관심 종목·쓴 글·댓글·공감과 함께 계정을 지웁니다 (되돌릴 수 없음)."
            + " 비밀번호가 틀리면 400 WRONG_PASSWORD",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH))
    @DeleteMapping("/me")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt,
                       @Valid @RequestBody AccountRequests.DeleteAccount request, HttpServletRequest http) {
        accountService.delete(userIdOf(jwt), request, http.getRemoteAddr());
    }

    @Operation(summary = "확인 질문 목록", description = "가입·질문 정하기 화면에서 고를 질문 [{code, text}]")
    @GetMapping("/recovery/questions")
    public List<AccountResponses.Question> questions() {
        return accountService.questions();
    }

    @Operation(summary = "비밀번호 찾기 1단계: 내 질문 보기", description = "없는 아이디이거나 질문을 정하지 않았으면 404 RECOVERY_NOT_SET")
    @PostMapping("/recovery/question")
    public AccountResponses.Question questionOf(@Valid @RequestBody AccountRequests.AskQuestion request) {
        return accountService.questionOf(request.loginId());
    }

    @Operation(summary = "비밀번호 찾기 2단계: 새 비밀번호로", description = "답이 맞으면 새 비밀번호로 바꿉니다 (204)."
            + " 답이 틀리면 400 RECOVERY_ANSWER_MISMATCH, 10분 안에 5번 틀리면 429 TOO_MANY_ATTEMPTS")
    @PostMapping("/recovery/reset")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resetPassword(@Valid @RequestBody AccountRequests.ResetPassword request, HttpServletRequest http) {
        accountService.resetPassword(request, http.getRemoteAddr());
    }

    @Operation(summary = "아이디 찾기", description = "확인 질문·답과 비밀번호가 모두 맞는 계정의 아이디."
            + " 없으면 404 ACCOUNT_NOT_FOUND, 10분 안에 5번 틀리면 429 TOO_MANY_ATTEMPTS")
    @PostMapping("/recovery/find-id")
    public AccountResponses.FoundLoginId findLoginId(@Valid @RequestBody AccountRequests.FindLoginId request,
                                                     HttpServletRequest http) {
        return accountService.findLoginId(request, http.getRemoteAddr());
    }

    private static Long userIdOf(Jwt jwt) {
        return Long.valueOf(jwt.getSubject());
    }
}
