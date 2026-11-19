package com.hkteam2.stocknews.feedback;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/** link_feedback 테이블. SQL은 resources/mapper/feedback/LinkFeedbackMapper.xml */
@Mapper
public interface LinkFeedbackMapper {

    /** 이 기사에 이 종목이 연결돼 있나 (없는 연결에는 의견을 받지 않음) */
    boolean linkExists(@Param("articleId") long articleId, @Param("stockCode") String stockCode);

    /** 넣은 줄 수. 같은 사람·연결·종류가 이미 있으면 0 (INSERT IGNORE) */
    int insert(@Param("articleId") long articleId, @Param("stockCode") String stockCode,
               @Param("userId") Long userId, @Param("kind") String kind);
}
