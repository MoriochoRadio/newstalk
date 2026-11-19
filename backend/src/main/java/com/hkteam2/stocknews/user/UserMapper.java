package com.hkteam2.stocknews.user;

import java.util.List;
import java.util.Optional;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/** users 테이블 (+ 탈퇴할 때 그 회원의 관심 종목·게시판 기록). SQL은 resources/mapper/user/UserMapper.xml */
@Mapper
public interface UserMapper {

    boolean existsByLoginId(String loginId);

    /** 저장 후 user.userId에 DB가 만든 번호가 채워짐 */
    void insert(User user);

    /** 없으면 Optional.empty() */
    Optional<User> findByLoginId(String loginId);

    Optional<User> findById(Long userId);

    int countWatchlist(Long userId);

    int countPosts(Long userId);

    int countComments(Long userId);

    void updatePassword(@Param("userId") Long userId, @Param("passwordHash") String passwordHash);

    void updateRecovery(@Param("userId") Long userId, @Param("question") String question,
                        @Param("answerHmac") String answerHmac);

    /** 아이디 찾기: 질문·답이 같은 계정 (보통 1개. 비밀번호를 하나씩 맞춰 봐야 해서 limit 개까지만) */
    List<User> findByRecovery(@Param("question") String question, @Param("answerHmac") String answerHmac,
                              @Param("limit") int limit);

    // 탈퇴: 외래 키 때문에 이 순서로 지움 (공감 → 댓글 → 글(남의 댓글·공감은 ON DELETE CASCADE) → 관심 종목 → 회원)
    int deleteLikesByUser(Long userId);

    int deleteCommentsByUser(Long userId);

    int deletePostsByUser(Long userId);

    int deleteWatchlistByUser(Long userId);

    int deleteById(Long userId);
}
