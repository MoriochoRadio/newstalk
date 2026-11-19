# 금융 뉴스 감성분석(LLM)과 SNS·투자자 커뮤니티 신호 품질: 논문 근거

확인일 2026-11-05. 표기: **[본문]** 논문 본문(HTML)을 열어 수치 확인, **[초록]** 논문 초록·서지 페이지 또는 모델 카드 확인, **[검색]** 검색 결과에 나온 페이지 발췌로만 확인. 논문의 존재와 서지는 모두 페이지에서 확인했지만, 페이지 내용은 요약 도구를 거쳐 읽었으므로 인용 전 원문 대조를 권장한다. 수익률·샤프 지수는 논문의 백테스트 결과를 옮긴 것이며 투자 조언이 아니다. **[미국]** 표시는 미국 시장·영어 자료 기반이라 한국 적용이 검증되지 않았다는 뜻이다.

## 1. 금융 감성분석 벤치마크와 방법: 정확도는 어느 정도인가

### Takeaway
"정확도"는 정답 정의에 따라 크게 달라서 논문 간 직접 비교가 어렵다. 사람 라벨 기준으로는 전체 데이터에서 F1 0.56~0.84대, 만장일치 문장만 쓰면 0.9 안팎이다. 주가 반응을 기준으로 삼는 연구의 수치는 사람 라벨 정확도와 다른 값이다.

### Cited Findings
- **When Is a Liability Not a Liability? Textual Analysis, Dictionaries, and 10-Ks** — Loughran & McDonald, 2011, Journal of Finance 66(1). 표본: 1994~2008 10-K. Harvard 사전의 부정어 중 거의 3/4이 금융 맥락에서는 부정어가 아니다. [미국][검색] — [SSRN](https://papers.ssrn.com/abstract=1331573)
- **FinBERT: Financial Sentiment Analysis with Pre-trained Language Models** — Araci, 2019, arXiv(암스테르담대 석사논문). 표본: Financial PhraseBank 4,845문장. 정확도/F1은 전체 0.86/0.84, 100% 합의 문장 0.97/0.95. 같은 조건에서 LSTM은 0.71/0.64, ULMFit은 0.83/0.79. [미국][본문] — [ar5iv](https://ar5iv.labs.arxiv.org/html/1908.10063)
- **FinBERT: A Large Language Model for Extracting Information from Financial Text** — Huang, Wang & Yang, 2023, Contemporary Accounting Research 40(2). 사전학습 약 49억 토큰, 애널리스트 문장 1만 건으로 미세조정. Loughran-McDonald 사전과 나이브베이즈·SVM·RF·CNN·LSTM을 크게 앞서며, 다른 방법이 중립으로 놓친 문장의 긍·부정을 특히 잘 잡는다. 정확도 수치는 확인하지 못했다. [미국][검색] — [HKUST](https://bm.hkust.edu.hk/bizinsight/2026/01/finbert-large-language-model-extracting-information-financial-text), [EconBiz](https://www.econbiz.de/Record/finbert-a-large-language-model-for-extracting-information-from-financial-text/10014289133)
- **Good Debt or Bad Debt: Detecting Semantic Orientations in Economic Texts** — Malo, Sinha, Takala, Korhonen & Wallenius, arXiv 2013 / JASIST 65(4), 2014. 문장 전체의 감성은 개별 단어의 사전 극성과 다를 수 있다는 점이 출발점이다. 사람 라벨 벤치마크인 Financial PhraseBank를 제시했다. 합의 구간별 규모는 2번 질문 참고. [미국][초록] — [arXiv](https://arxiv.org/abs/1307.5336)
- **BloombergGPT: A Large Language Model for Finance** — Wu et al., 2023, arXiv. 500억 파라미터, 금융 토큰 3,630억 개와 일반 토큰 3,450억 개로 학습. 금융 과제에서 기존 모델을 앞선다고 보고한다. 감성 F1은 초록에 없다. [미국][초록] — [arXiv](https://arxiv.org/abs/2303.17564)
- **FinGPT: Open-Source Financial Large Language Models** — Yang, Liu & Wang, 2023, arXiv. 오픈소스 프레임워크 제안 논문으로, 초록에 성능 수치가 없다. [초록] — [arXiv](https://arxiv.org/abs/2306.06031)
- **When FLUE Meets FLANG: Benchmarks and Large Pre-trained Language Model for Financial Domain** — Shah et al., 2022, arXiv. 금융 NLP 벤치마크 5개 과제를 제공한다. 감성 정확도 4.2% 향상, FLANG-ELECTRA F1 92%는 2차 요약에서만 확인했다. [미국][초록] — [arXiv](https://arxiv.org/abs/2211.00083)
- **Is ChatGPT a Good Sentiment Analyzer? A Preliminary Study** — Wang et al., 2023, arXiv. 7개 과제·17개 데이터셋(버전에 따라 다름). 무샷으로 미세조정 BERT에 필적하지만, 일부 도메인과 암시적 감성에서는 성능이 제한적이다. 금융 전용 연구는 아니다. [검색] — [arXiv](https://arxiv.org/abs/2304.04339)
- **Can ChatGPT Forecast Stock Price Movements? Return Predictability and Large Language Models** — Lopez-Lira & Tang, 2023~2025, arXiv v6(저널 정보 없음). 표본: 2021.10~2024.5, 4,123개사, 159,137건. GPT-4의 적중률은 거래 불가능한 초기 반응 기준 야간 93.3%, 장중 88.8%이고 이후 드리프트 기준으로는 58%, 55%다. 드리프트 전략 샤프는 야간 2.97, 비용 차감 전이며 FinBERT는 -0.33이다. 샤프는 2021Q4 6.54에서 2024년 1~5월 1.22로 하락했다. 점수는 YES=1, UNKNOWN=0, NO=-1로 매기며 평균 0.31, 중앙값 0이다. [미국][본문] — [arXiv](https://arxiv.org/html/2304.07619v6)
- **Transforming Sentiment Analysis in the Financial Domain with ChatGPT** — Fatouros et al., 2023, Machine Learning with Applications. ChatGPT 3.5 무샷이 FinBERT보다 분류 성능 약 35%, 시장 수익률 상관 36% 높다. 대상은 주식이 아닌 외환 헤드라인이다. 표본 수는 초록에 없다. [미국·외환][초록] — [arXiv](https://arxiv.org/abs/2308.07935)
- **Sentiment trading with large language models** — Kirtac & Germano, 2024, Finance Research Letters 62. 표본: 2010.1~2023.6 미국 뉴스 965,375건. 정확도는 OPT 74.4%, BERT 72.5%, FinBERT 72.2%, Loughran-McDonald 50.1%. 샤프는 비용 10bp 기준 OPT 3.05, BERT 2.11, FinBERT 2.07. [미국][검색] — [arXiv](https://arxiv.org/abs/2412.19245v1)
- **Sentiment spin: Attacking financial sentiment with GPT-3** — Leippold, 2023, Finance Research Letters 55. GPT-3로 문장을 바꿔 쓰면 사전 기반 방법을 속일 수 있다. PhraseBank 부정 문장에서 성공률이 약 99%였고, BERT 같은 문맥 모델은 견고했다. 후속 연구는 FinBERT·Fin-GPT도 취약하다고 보고했다. [미국][검색] — [ZORA](https://www.zora.uzh.ch/entities/publication/980bfe68-bfaf-4018-b62b-0ea4b9fa9064), [후속 SFI](https://sfi.ch/de/publications/n-24-59-battle-of-transformers-adversarial-attacks-on-financial-sentiment-models)
- 결과 충돌: Lopez-Lira & Tang에서는 FinBERT 샤프가 -0.33인데 Kirtac & Germano에서는 2.07이다. 기간, 표본, 비용 가정이 서로 다르다. — [Lopez-Lira](https://arxiv.org/html/2304.07619v6), [Kirtac](https://arxiv.org/abs/2412.19245v1)

### Inferences
- 서비스의 LLM 감성에 "정확도 X%"를 붙이려면 자체 한국어 라벨셋으로 측정해야 한다. 위 수치를 빌려 쓸 수 없다.
- 사전(regex 포함) 방식은 표현을 바꾸면 쉽게 뚫린다는 Leippold의 결과가 광고 정규식 필터에도 비슷하게 적용될 가능성이 있다. 다만 이 논문은 광고 필터를 시험한 것이 아니다.

### Gaps
- BloombergGPT 논문 자체의 감성 F1은 확인하지 못했다. 한 서베이에 0.51이 있지만 데이터셋 표기가 불명확해 근거로 쓰지 않았다.
- Kirtac & Germano의 "accuracy" 정답 정의를 확인하지 못했다. 사람 라벨 정확도로 읽으면 안 될 수 있다.
- Lopez-Lira & Tang의 UNKNOWN 비율은 읽은 범위(앞 10만 자)에 없었다.

## 2. 기업(엔티티) 단위 감성 vs 문서 단위 감성

### Takeaway
여러 기업이 나오는 기사는 흔하고 기업별 감성이 엇갈리기도 하므로, 문서 단위 점수를 기업에 그대로 복사하면 정확도가 크게 떨어진다. 기업 단위 평가에서 무샷 ChatGPT는 미세조정 모델보다 낮았다.

### Cited Findings
- **SEntFiN 1.0: Entity-Aware Sentiment Analysis for Financial News** — Sinha, Kedas, Kumar & Malo, 2022, JASIST(arXiv 2023). 표본: 헤드라인 10,753건, 엔티티 감성 14,404건. 다중 엔티티 헤드라인은 2,847건(약 26.5%)이다. 엔티티 인식 모델의 평균 정확도는 94.29%, F1은 93.27%다. 헤드라인에 감성 하나만 주는 방식의 긍/부/중 정확도는 HuggingFace 모델 74.90/82.35/58.79%, VADER 65.17/74.02/39.70%로, 저자들도 "clearly quite low"라고 평가했다. [인도 금융뉴스·영어][본문] — [arXiv](https://arxiv.org/html/2305.12257)
- **FinEntity: Entity-level Sentiment Classification for Financial Texts** — Tang, Yang, Huang, Tam & Tang, 2023, EMNLP. 표본: 979문단, 엔티티 2,131개. 다중 엔티티 문단이 60.16%이고 라벨은 중립 53.03%, 긍정 23.60%, 부정 23.37%다. Micro F1은 FinBERT-CRF 0.84, ChatGPT 무샷 0.59, 퓨샷 0.67. [미국][본문] — [arXiv](https://arxiv.org/html/2310.12406), [ACL](https://aclanthology.org/2023.emnlp-main.956)
- **Removing Non-Stationary Knowledge From Pre-Trained Language Models for Entity-Level Sentiment Classification in Finance** — Son, Lee, Kang & Hahm, 2023, AAAI 2023 워크숍. 한국어 금융 ASC 데이터셋 KorFinASC 12,613건을 구축했다. 사전학습 모델에 저장된 기업에 대한 낡은 지식이 예측력을 부풀린다고 지적하고, 대상 기업명을 가리는 TGT-Masking과 전이학습을 결합해 정확도를 22.63% 개선했다. Hugging Face 카드는 8,818건으로 표기해 버전 차이가 있을 수 있다. [한국][초록] — [arXiv](https://arxiv.org/abs/2301.03136), [데이터셋](https://huggingface.co/datasets/amphora/korfin-asc/blob/main/README.md)
- **It's Time to Reason: Annotating Argumentation Structures in Financial Earnings Calls: The FinArg Dataset** — Alhamzeh et al., 2022, FinNLP. 어닝콜 804문서, 주석 연구 136문서, 주석자 4명. 일치도는 αU 0.70, α 0.81. 감성이 아니라 논증 구조 데이터셋이다. [미국][검색] — [ACL](https://preview.aclanthology.org/setup/2022.finnlp-1.22)
- **Assessing Look-Ahead Bias in Stock Return Predictions Generated By GPT Sentiment Analysis** — Glasserman & Lin, 2023, arXiv. 기간: 표본 내 2015.1~2021.9, 표본 외 2021.10~2022.12. GPT-3.5의 기업 일반 지식은 뉴스 감성 판단에 득보다 실이 컸고, 익명화 헤드라인이 표본 내 수익률이 더 높았다(대형주에서 강함). 표본 외에서는 차이의 유의성이 사라지고 대형주에서만 경계선 수준으로 남았다. [미국][검색] — [arXiv](https://arxiv.org/abs/2309.17322)

### Inferences
- 대형주 위주인 "뉴스 많은 50종목"은 LLM이 기업을 잘 아는 구간이다. 기업명을 가리고 다시 채점해 비교하는 실험이 편향 점검으로 적합해 보인다(Glasserman & Lin, Son et al.의 방법을 원용. 서비스에서 검증된 것은 아님).
- 고정 관련도 0.50을 직접 다룬 논문은 찾지 못했다. 다만 다중 엔티티 비율 26~60%를 보면 글마다 해당 종목과의 관련성이 다를 수밖에 없어, 상수는 이 차이를 지운다.

### Gaps
- "SNS 글의 종목 관련도 점수를 어떻게 매겨야 하는가"를 직접 평가한 논문은 찾지 못했다.

## 3. 중립 클래스, 긍정 편향, 사람 라벨의 신뢰도, 실행마다 달라지는 결과, 수익률을 정답으로 쓰는 문제

### Takeaway
"중립 기사를 긍정으로 채점"은 논문에서 반복 확인된 대표 오류이며, 사람끼리도 가장 많이 갈리는 경계다. temperature 0으로도 재현성은 보장되지 않는다. 당일 수익률은 검증 지표로 쓸 수 있어도 감성의 정답으로 보기는 어렵다.

### Cited Findings
- **사람 라벨 합의도**: Financial PhraseBank 4,845문장 중 100% 합의는 2,262(46.7%, 비율은 필자 계산), 75~99%는 1,191, 66~74%는 765, 50~65%는 627이다. [본문] — [Araci 2019](https://ar5iv.labs.arxiv.org/html/1908.10063)
- **구분쌍별 합의**: 긍-부 98.7%, 부-중 94.2%, 긍-중 75.2%. [본문] — [Vamvourellis & Mehta 2025](https://arxiv.org/html/2506.04574). 독립 데이터에서도 부-긍 98.26%, 부-중 96.85%, 중-긍 80.36%로 같은 양상이다. [본문] — [SEntFiN](https://arxiv.org/html/2305.12257)
- **Reasoning or Overthinking: Evaluating Large Language Models on Financial Sentiment Analysis** — Vamvourellis & Mehta, 2025, arXiv. 표본: PhraseBank 4,845문장. 모든 설정에서 가장 잦은 오류는 중립을 긍정으로 예측하는 것이다. 중립→긍정 오분류는 GPT-4o 11.8~14%, GPT-4.1 약 14%(CoT 계열 19~22%), o3-mini 22~26%다. CoT 없는 GPT-4o의 Macro F1은 합의 50~65% 구간 0.561, 66~74% 0.677, 75~99% 0.727, 100% 0.895로, 합의가 낮을수록 떨어진다. 추론을 늘려도 성능이 개선되지 않았다. [미국][본문] — [arXiv](https://arxiv.org/html/2506.04574)
- **Are Large Language Models Good In-context Learners for Financial Sentiment Analysis?** — Wei & Liu, 2025, arXiv(ICLR 2025 워크숍 페이지 존재). 표본: FiQA 테스트 150건(클래스당 50), Twitter 테스트 2,388건. LLM 10종 무샷 정확도는 FiQA 66~75.33%, Twitter 75.13~83.42%. 저자들은 무샷에서 중립이 주로 틀리고 예시를 주면 중립이 가장 크게 개선된다고 본다. 예시를 넣어 오히려 내려간 사례도 있다(DeepSeek V3 FiQA 71.33→67.33). [본문] — [arXiv](https://arxiv.org/html/2503.04873v1), [ICLR](https://iclr.cc/virtual/2025/33861)
- 결과 충돌: FinEntity에서는 퓨샷으로 긍정 F1이 0.39→0.73으로 오른 반면 중립 F1은 0.71→0.61로 내렸다. Wei & Liu의 "예시가 중립을 개선"과 반대다. 과제(엔티티 vs 문장), 모델이 달라 일반화에 주의해야 한다. — [FinEntity](https://arxiv.org/html/2310.12406)
- **An overview of model uncertainty and variability in LLM-based sentiment analysis** — Herrera-Poyatos et al., 2025, Frontiers in AI 리뷰. 온도, 디코딩 무작위성, 프롬프트 표현, 모델 버전을 변동 원인으로 정리한다. GPT-4o로 같은 리뷰를 100회 채점하니 0.3~0.6으로 흔들렸다는 사례를 소개한다(예시이며 2차 요약 확인, 금융 데이터 아님). [검색] — [arXiv](https://arxiv.org/abs/2504.04462), [PMC](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12375657/)
- **Non-Determinism of "Deterministic" LLM Settings** — Atil et al., 2024~2025, arXiv/Eval4NLP. LLM 5종, 과제 8개, 10회 반복. temperature 0에서도 출력이 결정적이지 않고 안정성은 모델과 과제에 따라 다르다. 금융 전용 연구는 아니다. [검색] — [arXiv](https://arxiv.org/html/2408.04667v5)
- **Predicting Returns With Text Data** — Ke, Kelly & Xiu, 2019, NBER WP 26186. Dow Jones Newswires 사용. 사전 대신 글과 수익률의 결합 행태에서 감성을 학습하는 SESTM을 제안했으며, 수익률을 예측 목적의 지도 신호로 쓰는 정당한 선례다. 다만 목적은 "수익률 예측"이다. [미국][검색] — [NBER](https://www.nber.org/papers/w26186)
- **Giving Content to Investor Sentiment: The Role of Media in the Stock Market** — Tetlock, 2007, Journal of Finance 62(3). 표본: WSJ 칼럼, 1984~1999. 미디어 비관은 가격 하락 압력 뒤 펀더멘털로 되돌림을 보이며, 새로운 펀더멘털 정보라는 가설은 기각된다. 즉 단기 가격 움직임이 곧 정보의 내용은 아니다. [미국][검색] — [SSRN](https://papers.ssrn.com/abstract=685145), [PDF](https://www.columbia.edu/~pt2238/papers/Tetlock_Media_Sentiment_JF.pdf)
- Lopez-Lira & Tang의 적중률 차이(초기 반응 약 90% vs 드리프트 55~58%)는 정답 기준으로 어느 구간을 쓰느냐가 수치를 크게 바꾼다는 근거다. [본문] — [arXiv](https://arxiv.org/html/2304.07619v6)

### Inferences
- 긍-중 합의가 75~80%라면 그 경계에서 LLM이 사람과 100% 일치하기를 기대하기 어렵다. 그러므로 오분류율 목표는 만장일치 문장으로 재는 값과 애매한 문장을 포함한 값을 나눠 잡아야 한다.
- 실행 변동은 긍-중 경계의 애매한 글에서 특히 클 가능성이 있다(직접 측정한 금융 논문은 못 찾음). 같은 글 N회 채점의 라벨 불일치율을 재서 "불확실" 상태로 내리는 것이 논문의 권고와 맞는 저비용 대응이다.
- 당일 수익률은 시장 전체 움직임, 다른 뉴스, 사후 지식이 섞이므로 "감성 정답"이 아니라 보조 검증 지표로 쓰는 편이 안전하다. 라벨 자체는 사람 기준, 수익률은 별도 지표로 분리하는 것이 해석상 깔끔하다.

### Gaps
- FinBERT 논문 오류분석 문장이 변환본에서 "73% of the failures happen between labels positive and negative, while same number is 5% for negative and positive"로 읽힌다. 앞뒤 맥락은 긍-중 혼동을 가리켜 오탈자로 보인다. PDF 원문 대조 전에는 인용하지 말 것.
- 금융 뉴스에서 동일 LLM의 라벨 불일치율을 측정한 논문은 찾지 못했다.
- "당일 수익률을 감성 정답으로 써도 되는가"를 정면으로 검증한 논문은 찾지 못했다. 위 내용은 관련 논문에서 끌어낸 추론이다.

## 4. 한국어 금융 감성분석과 한국 시장

### Takeaway
한국어 모델과 벤치마크는 있지만 대부분 모델 카드·학회 논문 수준이며, 모델 간 동일 조건 비교는 찾지 못했다. 네이버 종목토론실 연구는 표본이 작거나 수치가 약해 강한 근거로 쓰기 어렵다.

### Cited Findings
- **KR-FinBert / KR-FinBert-SC** — SNU NLP, Hugging Face 모델 카드. 사전학습: 뉴스 제목·본문 440,067건, 애널리스트 리포트 11,237건. 라벨 5만 건 기준 정확도 0.963(KR-BERT-MEDIUM 0.958, KoBert 0.817). 원논문은 확인하지 못했다. [한국][초록] — [모델 카드](https://huggingface.co/snunlp/KR-FinBert-SC)
- **KF-DeBERTa: Financial Domain-specific Pre-trained Language Model** — 전은광·김정대·송민상·유주현, 2023, 한글 및 한국어 정보처리 학술대회 pp.143-148. 정확도: FN-Sentiment v1 99.36, v2 92.29, KorFPB(PhraseBank 번역본) 93.47. 비교 모델 KLUE-RoBERTa는 KorFPB 90.97, KoELECTRA는 92.36. 자체 보고 수치다. 저자 한글 표기는 영문명에서 옮긴 것이다. [한국][초록] — [모델 카드](https://huggingface.co/kakaobank/kf-deberta-base)
- **KRX Bench: Automating Financial Benchmark Creation via Large Language Models** — Son, Jeon, Hwang & Jung, 2024, FinNLP. 미·일·한 상장사 관련 1,002문항. 상장사 지식 평가이지 감성 벤치마크가 아니다. [초록] — [ACL](https://aclanthology.org/2024.finnlp-1.2/)
- **KFinEval-Pilot: A Comprehensive Benchmark Suite for Korean Financial Language Understanding** — 2025, arXiv. 금융 지식·법률 추론·금융 유해성 1,000문항 이상. 감성 전용은 아니며 모델별 수치는 2차 자료로만 확인했다. [검색] — [arXiv](https://arxiv.org/abs/2504.13216v1)
- **한국 뉴스 금융 감성지수(KNFSI) 제안 및 KOSPI 200과의 연관성 평가** — 2025, 한국자료분석학회지 27(2). 2023년 뉴스 헤드라인에 KR-FinBERT 적용. KOSPI 200 수익률과 양의 상관, 부정 지수는 하락기에 설명력이 강하다. 단일 연도이고 계수·표본 수는 페이지에 없다. 저자명도 페이지에 없다. [한국][초록] — [교보 스콜라](https://scholar.kyobobook.co.kr/article/detail/4010070811013)
- **Fin-BERT 모델 기반 감성 점수 활용 주가 예측** — 2025, 한국자료분석학회지 27(1). 저자들은 뉴스가 "중립적인 경향이 너무 강해서" 분류가 어렵다고 보고 네이버 종목토론실을 택했다. RF·XGBoost·LSTM 모두 감성 점수 포함 시 RMSE·MAE가 개선됐다. 수치와 표본 수는 페이지에 없다. [한국][초록] — [교보 스콜라](https://scholar.kyobobook.co.kr/article/detail/4010070472339)
- **SNS감성 분석을 이용한 주가 방향성 예측: 네이버 주식토론방 데이터를 이용하여** — 김명진·류지혜·차동호·심민규, 2020, 한국전자거래학회지 25(4). 20종목, 6개월 댓글, 1시간 뒤 예측. 방향은 13/20종목, 변동폭은 16/20종목에서 정확도 50% 이상. [한국][초록] — [KoreaScience](https://koreascience.kr/article/JAKO202034965718425.page?lang=ko)
- **투자자의 정보공유활동에 따른 애널리스트 이익예측과 주가수익률 간의 관련성** — 2023, 재무와 회계정보저널 23(4). 종목토론실 게시글 수는 리포트 발표일 초과수익률과 양의 관계이고, 회계용어가 포함된 게시글 수도 마찬가지다. 감성보다 활동량·정보성에 주목한 연구다. [한국][초록] — [교보 스콜라](https://scholar.kyobobook.co.kr/article/detail/4010068535279)
- **머신러닝을 활용한 가짜리뷰 탐지 연구: 사용자 행동 분석을 중심으로** — 이민철·윤현식, 2020, 지식경영연구 21(3). 네이버 블로그 글에서 작성자 행동(전체 포스트 수, 게시일, 이미지 수, 메뉴 수, 글 길이, 좋아요)으로 광고 글을 판별했고 랜덤포레스트가 최고 성능이었다. 도메인은 주식이 아니며 표본과 정확도는 페이지에 없다. [한국][초록] — [KoreaScience](https://koreascience.kr/article/JAKO202029565519184.page)
- 추가 후보(검색 발췌만 확인): 증시 뉴스 감성사전 Word2Vec 구축 연구(뉴스 약 2.5만 건) — [KoreaScience](https://koreascience.kr/article/JAKO201831960581443.page?lang=en); 한국어 금융 감성사전 KOSELF — [KoreaScience](https://www.koreascience.or.kr/article/JAKO202312433818906.pdf); 빅데이터 기반 네이버 블로그 가짜 리뷰 필터링 — [KoreaScience](https://koreascience.kr/article/JAKO201907752705784.pdf).

### Inferences
- 13/20종목에서 50% 이상이라는 결과는 동전 던지기 기준선과 거의 같은 문턱이므로, 예측력의 근거로 삼기는 약하다.
- 정규식 광고 필터를 보강한다면 글 내용 대신 작성자 행동 특성을 쓰는 이민철·윤현식의 접근이 후보가 된다. 주식 블로그에서 그대로 통할지는 검증되지 않았다.
- 한국어 모델의 높은 정확도(96%, 99%)는 제공자 자체 보고이며 라벨 기준을 알 수 없어, 서비스 데이터의 성능으로 옮겨 읽으면 안 된다.

### Gaps
- **KoFinSA**: 이 이름의 논문이나 데이터셋을 확인하지 못했다. 가장 가까운 것은 KorFinASC다.
- **KoFinBERT**: 원논문을 찾지 못했다.
- **KCI·DBpia·RISS**: 직접 검색하지 못했고 KoreaScience, 교보 스콜라, 대학 저장소를 통해 찾았다. KCI 등재 여부는 미확인이다.
- 한국어 뉴스에서 LLM의 긍정 편향을 측정한 논문은 찾지 못했다.
- 네이버 **블로그·카페** 글의 감성과 주가 관계를 다룬 논문은 찾지 못했다. 찾은 연구는 모두 종목토론실이다.

## 5. 소셜 신호와 주가: 신호인가 소음인가

### Takeaway
증거는 엇갈린다. 대규모 게시판 감성은 예측력이 없다는 연구가 있고, 분석 글이 많은 플랫폼에서는 예측력이 있다는 연구도 있다. 플랫폼의 성격과 시기에 따라 신호가 달라지고 사라지기도 한다.

### Cited Findings
- **Is All That Talk Just Noise? The Information Content of Internet Stock Message Boards** — Antweiler & Frank, 2004, Journal of Finance 59(3). 표본: Yahoo! Finance 등 150만 건 이상. 게시판 감성은 강하게 긍정 편향되며, 동시점 상관은 유의하지만 음수이고, 수익률 예측은 약하다고 후속 문헌과 기사가 요약한다. 메시지 활동은 변동성·거래량과 관련해 시험됐다. 원문을 열지 못해 2차 요약에 의존한다. [미국][검색] — [EconBiz](https://www.econbiz.de/Record/is-all-that-talk-just-noise-the-information-content-of-internet-stock-message-boards/10005214323)
- **Investor sentiment from internet message postings and the predictability of stock returns** — Kim & Kim, 2014, JEBO 107. 표본: Yahoo! Finance 91개사, 2005.1~2010.12, 3,200만 건 이상. 수익률·변동성·거래량 어느 쪽도 예측하지 못했고, 감성은 오히려 과거 주가 성과의 영향을 받는다. **주의: 저자가 한국인일 뿐 네이버나 한국 시장 자료가 아니다.** [미국][초록] — [EconPapers](https://econpapers.repec.org/RePEc:eee:jeborg:v:107:y:2014:i:pb:p:708-729)
- **Twitter mood predicts the stock market** — Bollen, Mao & Zeng, 2011, Journal of Computational Science. DJIA 일간 등락 예측 정확도 87.6%. [미국][검색] — [arXiv](https://arxiv.org/abs/1010.3003)
- **Shy of the Character Limit: "Twitter Mood Predicts the Stock Market" Revisited** — Lachanski & Pav, 2017, Econ Journal Watch 14(3). 원 논문의 p값 패턴을 재현하지 못했고, 데이터 스누핑과 일치하며, 표본 외 예측력의 증거가 없다. 원 논문 전략을 표방한 펀드는 2012년 초 폐업했다. [미국][검색] — [Econ Journal Watch](https://econjwatch.org/articles/shy-of-the-character-limit-twitter-mood-predicts-the-stock-market-revisited)
- **Wisdom of Crowds: The Value of Stock Opinions Transmitted Through Social Media** — Chen, De, Hu & Hwang, 2014, RFS 27(5). 표본: Seeking Alpha 2005~2012. 글과 댓글 모두 미래 수익률과 어닝 서프라이즈를 예측하며, 전통 정보원을 통제해도 유지된다. 많은 댓글을 합칠수록 강해진다. [미국][검색] — [EconPapers](https://econpapers.repec.org/RePEc:oup:rfinst:v:27:y:2014:i:5:p:1367-1403.)
- **Tweets and Trades: the Information Content of Stock Microblogs** — Sprenger, Tumasjan, Sandner & Welpe, 2014, European Financial Management 20(5). 표본: 약 25만 건, S&P 100(249,533건은 2차 요약). 감성-수익률, 건수-거래량, 의견 불일치-변동성이 연관되며, 평균 이상 조언자가 더 많이 리트윗된다. [미국][검색] — [EconPapers](https://econpapers.repec.org/RePEc:bla:eufman:v:20:y:2014:i:5:p:926-957)
- **Place Your Bets? The Value of Investment Research on Reddit's Wallstreetbets** — Bradley, Hanousek, Jame & Xiao, 2024, RFS 37(5). 분석 글(DD)은 GameStop 사건(2021.1) 이전에는 수익률과 현금흐름 뉴스를 예측했으나 이후 예측력이 사라졌다. [미국][검색] — [IDEAS](https://ideas.repec.org/a/oup/rfinst/v37y2024i5p1409-1459..html)
- **The democratization of investment research and the informativeness of retail investor trading** — Farrell, Green, Jame & Markov, 2022, JFE 145(2). Seeking Alpha 게재 지연을 활용한 설계로, 게재 후 개인 주문 불균형의 수익률 예측력이 커진다. 역량 높은 기고자일수록 강하다. [미국][검색] — [IDEAS](https://ideas.repec.org/a/eee/jfinec/v145y2022i2p616-641.html)
- **Echo Chambers** — Cookson, Engelberg & Mullins, 2023, RFS 36(2). 표본: StockTwits 사용자 약 40만 명. 강세 성향 사용자는 약세 성향 사용자보다 같은 종목 강세 사용자를 팔로우할 가능성이 약 5배 높고, 50일간 강세 글을 약 62건 더, 약세 글을 24건 덜 본다. 이 경향은 저조한 후속 수익률, 정보 고립, 거래량 증가와 연결된다. [미국][검색] — [콜로라도대](https://www.colorado.edu/business/faculty-research/2025/09/05/echo-chambers-review-financial-studies), [EconPapers](https://econpapers.repec.org/RePEc:oup:rfinst:v:36:y:2023:i:2:p:450-500.)
- **The impact of social and conventional media on firm equity value: A sentiment analysis approach** — Yu, Duan & Cao, 2013, Decision Support Systems 55(4). 표본: 6개 산업 824개사. 블로그, 포럼, 트위터, 전통 미디어를 비교했다. 소셜 미디어 전체가 전통 미디어보다 단기 주가 성과와 관계가 강하며, 소셜 미디어 유형별 효과가 크게 다르다. [미국][검색] — [Bohrium](https://bohrium.dp.tech/paper/arxiv/56d8e088dabfae2eee0f1098)
- **Social Media and Firm Equity Value** — Luo, Zhang & Duan, 2013, Information Systems Research 24(1). 웹 블로그와 소비자 평점을 VAR로 분석했다. 위 논문과 함께 블로그 신호 문헌으로 볼 수 있다. 결과 수치는 확인하지 못했다. [미국][검색] — [INFORMS](https://pubsonline.informs.org/doi/fpi/10.1287/isre.1120.0462)

### Inferences
- "블로그가 의견이 아니라 분석 글 위주"라는 관찰이 곧 신호 부재를 뜻하지는 않는다. Chen, Farrell, Bradley는 오히려 분석 글의 정보성을 보였다. 다만 분석 글을 감성 비율에 넣으면 "투자자 의견"이라는 해석이 틀리게 되므로, 글 유형을 구분하는 편이 논리적이다.
- 감성이 과거 주가를 따라간다는 Kim & Kim의 결과는, 비율 표시가 지금 시장 분위기를 보여줄 뿐 앞날을 말해주지 않을 수 있음을 시사한다.

### Gaps
- 블로그와 토론 게시판의 신호 차이를 방향·크기까지 비교한 수치는 확인하지 못했다. Yu et al.은 유형별 차이를 보고하지만 원문이 유료라 세부 계수를 못 읽었다.
- 집계 신호에 필요한 표본 크기의 최소 기준을 제시한 논문은 찾지 못했다.

## 6. 스팸·봇·조작과 루머, SNS를 사용자에게 보여줘야 하는가

### Takeaway
조작과 가짜 글은 실재하며 독자는 이를 잘 가려내지 못한다. 가격 효과는 주로 소형·저유동 종목에서 확인됐으므로, 뉴스 많은 대형 종목 50개에 그대로 적용하면 안 된다. "SNS를 보여줘도 되는가"를 직접 시험한 연구는 찾지 못했다.

### Cited Findings
- **On the effects of stock spam e-mails** — Hanke & Hauser, 2008, Journal of Financial Markets 11(1). 스팸 메일이 수익률, 변동성, 스프레드, 거래량 모두에 유의한 영향을 준다. 표본 수는 미확인. [미국][검색] — [IDEAS](https://ideas.repec.org/a/eee/finmar/v11y2008i1p57-83.html)
- **Spam Works: Evidence from Stock Touts and Corresponding Market Activity** — Frieder & Zittrain, 2006(SSRN), 2008, Hastings Comm. & Ent. Law Journal. 표본: 2004.1~2005.7 스팸 7.5만 건 이상. 추천 종목이 가장 활발히 거래될 확률이 평일 4%에서 추천일 70%(발행본 초록 81%, 버전 차이)로 뛰고, 이후 수익률은 유의한 음수다. 대부분 Pink Sheets 종목이다. [미국][검색] — [Harvard](https://cyber.harvard.edu/publications/2007/Spam_Works)
- **Cashtag piggybacking: uncovering spam and bot activity in stock microblogs on Twitter** — Cresci, Lillo, Regoli, Tardelli & Tesconi, 2019, ACM TWEB 13(2). 표본: 미국 5대 시장 관련 트윗 900만 건. 봇 집단이 인기 대형주 캐시태그에 저가주를 끼워 홍보한다. 의심 계정 표본의 71%가 봇으로 판별됐다(전체 비율 아님). 저자들은 UGC 기반 주가 연구에 스팸·봇 탐지를 필수로 권고한다. [미국][검색] — [arXiv](https://www.arxiv.org/abs/1804.04406v1)
- **Market manipulation and suspicious stock recommendations on social media** — Renault, EFMA 2017 학회 논문. OTC 종목 관련 트윗 급증이 급격한 가격 상승과 연결되어 조작·홍보 설명을 지지한다. 표본 수와 최종 게재 정보는 미확인. [미국][검색] — [EFMA PDF](https://efmaefm.org/0EFMAMEETINGS/EFMA%20ANNUAL%20MEETINGS/2017-Athens/papers/EFMA2017_0387_fullpaper.pdf)
- **Social Media and Financial News Manipulation** — Kogan, Moskowitz & Niessner, 2023, Review of Finance 27(4). SEC 잠입 조사를 활용했다. 기만 기사는 소형주 가격을 일시적으로 올리고, 적발 이후 플랫폼의 정보 전달력이 전반적으로 약해진다(소형·불투명 기업에서 강함). [미국][검색] — [EconPapers](https://econpapers.repec.org/RePEc:oup:revfin:v:27:y:2023:i:4:p:1229-1268.), [Yale](https://insights.som.yale.edu/insights/does-fake-news-sway-financial-markets)
- **Fake News, Investor Attention, and Market Reaction** — Clarke, Chen, Du & Hu, 2021, Information Systems Research 32(1). 가짜 글은 대조군보다 주목을 훨씬 많이 받는다. 댓글 작성자는 판별 능력이 없고 편집자는 제한적이다. 반면 시장 전체의 가격 반응은 대조군과 차이가 없었고, 기계학습이 언어 특성으로 가짜 글을 식별했다. [미국][검색] — [INFORMS](https://pubsonline.informs.org/doi/fpi/10.1287/isre.2019.0910)
- **Rumor Has It: Sensationalism in Financial Media** — Ahern & Sosyura, 2015, RFS 28(7). 합병 루머 기사 2,142건, 기자 382명, 루머 501건(수치는 2차 요약). 기사·기자 특성으로 루머의 실현 여부를 예측할 수 있지만 투자자는 이를 충분히 반영하지 않으며, 초기 과잉반응 뒤 되돌림이 나타난다. 전통 언론 대상 연구다. [미국][검색] — [IDEAS](https://ideas.repec.org/a/oup/rfinst/v28y2015i7p2050-2093..html), [CFA 요약](https://rpc.cfainstitute.org/en/research/cfa-digest/2016/06/rumor-has-it-sensationalism-in-financial-media-digest-summary)

### Inferences
- 위 근거에서 "SNS 금지"나 "그대로 공개"는 어느 쪽도 바로 도출되지 않는다. 다만 독자가 가짜를 못 가린다는 Clarke 등의 결과를 보면 "미확인 정보" 라벨 하나로 충분하다고 가정하기 어렵다. 라벨 효과를 시험한 연구를 찾지 못했으므로 이 판단 자체도 미검증이다.
- 비율 숫자는 표본이 작을 때 근거 없는 정밀함을 줄 수 있으므로, 집계에 쓴 글 수를 함께 표시하고 적을 때는 비율을 숨기는 방안이 합리적이다. 임계값은 논문 근거가 없어 팀이 정해야 한다. 규모 참고: Kim & Kim은 91개사 6년에 3,200만 건으로, 산술상 기업당 하루 약 160건이고(필자 계산) 그래도 예측력이 없었다.
- 조작 연구의 가격 효과는 소형주 중심이어서 대상 50종목에는 약하게 적용될 수 있다. 반대로 Cresci의 piggybacking은 인기 대형주 태그를 노리므로, 대형주 수집 글에도 다른 저가주를 홍보하는 글이 섞일 수 있다. 이 패턴이 네이버에도 있는지는 미검증이고, 저자들의 스팸 탐지 권고는 트위터 맥락이다.

### Gaps
- 금융 정보 서비스에서 "미확인 정보" 라벨이 사용자 판단에 미치는 효과를 시험한 논문은 찾지 못했다. 이번 조사 범위에서는 일반 허위정보 라벨 연구까지 넓혀 찾지 않았다.
- 네이버 종목토론실·블로그·카페의 스팸 비율이나 주식 조작을 직접 측정한 한국 논문은 찾지 못했다.
- 위 영어권 결과가 한국의 개인 투자자 비중, 플랫폼 구조, 규제 환경에서도 성립하는지는 확인되지 않았다.
