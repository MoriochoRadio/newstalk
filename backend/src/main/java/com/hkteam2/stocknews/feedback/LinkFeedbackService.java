package com.hkteam2.stocknews.feedback;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hkteam2.stocknews.common.error.BusinessException;
import com.hkteam2.stocknews.common.error.ErrorCode;

@Service
public class LinkFeedbackService {

    private final LinkFeedbackMapper mapper;

    public LinkFeedbackService(LinkFeedbackMapper mapper) {
        this.mapper = mapper;
    }

    /** 같은 의견을 여러 번 보내도 1건만 남음 (결과는 같음) */
    @Transactional
    public void report(Long userId, long articleId, String stockCode, String kind) {
        if (!mapper.linkExists(articleId, stockCode)) {
            throw new BusinessException(ErrorCode.LINK_NOT_FOUND);
        }
        mapper.insert(articleId, stockCode, userId, kind);
    }
}
