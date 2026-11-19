# LLM 판정자·주석자의 신뢰도와 출력 비결정성 (근거 논문 조사)

조사일: 2026-11-05. 대상 상황: Claude 라벨 gold set 100건, 독립 LLM 판정자 30건 겹침 0.947(Dice/F1형, kappa 아님), 사람 검수 없음. 추출용 nano 모델은 같은 기사 반복 실행에서 회사 수 7, 7, 1. temperature 미설정. 코드 규칙 적용 후 10건 3회 실행의 최종 종목 목록은 일치.

확인 수준 표시: **[초록]** arXiv/출판사 페이지 또는 API에서 서지와 초록을 직접 읽음. **[본문]** 본문까지 읽음. **[검색]** 검색 결과 요약으로만 확인(원문을 직접 열지 못함). 수치 중 **[검색]** 표시는 인용 전에 원문 대조가 필요하다. 학회명은 페이지에서 확인된 것만 적었고, 없으면 arXiv로 표기했다.

## 1. LLM 주석은 사람과 비교해 얼마나 믿을 만하고, 언제 실패하는가

### Takeaway
평균 성능은 좋을 수 있지만 과제별 편차가 매우 크다(GPT-4 F1 0.059~0.969). 그래서 거의 모든 방법론 논문이 "과제별 사람 검증 표본"을 요구한다.

### Cited Findings
- **Pangakis, Wolken, Fasching (2023), Automated Annotation with Generative AI Requires Validation, arXiv.** 표본: 11개 데이터셋 27개 과제, GPT-4. F1 중앙값 0.707(범위 0.059~0.969), 정밀도 중앙값 0.650, 재현율 중앙값 0.829. 27개 중 9개는 정밀도나 재현율이 0.5 미만. 검증용으로 무작위 250~1,250건 사람 라벨을 권고. 일관성 1.0 표본은 그 미만보다 정확도가 19.4%p 높음. 3회 이상 반복 분류를 권고. [본문] — [arXiv](https://arxiv.org/abs/2306.00176), [본문 HTML](https://ar5iv.labs.arxiv.org/html/2306.00176). 적용: 100건 gold의 사람 검수 규모 기준, 그리고 7/7/1 같은 불일치 기사를 오류 후보로 쓰는 근거.
- **Pangakis, Wolken (2024/2025), Keeping Humans in the Loop: Human-Centered Automated Annotation with Generative AI, ICWSM 2025.** 표본: 27개 과제, 비공개 데이터셋(오염 방지). 라벨 품질은 대체로 높지만 같은 데이터셋 안에서도 과제별 차이가 크고, 프롬프트 튜닝 후에도 사람 판단과 크게 어긋나는 경우가 있음. [초록] — [arXiv](https://arxiv.org/abs/2409.09467). 적용: 프롬프트를 다듬어도 사람 검증을 대체하지 못한다는 근거.
- **Pangakis, Wolken (2024), Knowledge Distillation in Automated Annotation, 6th NLP+CSS Workshop.** 표본: 14개 분류 과제. GPT-4 라벨로 학습한 분류기가 사람 라벨로 학습한 분류기와 비슷한 성능. [초록] — [arXiv](https://arxiv.org/abs/2406.17633). 적용: LLM 라벨이 쓸모없다는 뜻은 아니라는 반대쪽 근거(단, 이 평가도 사람 라벨이 기준).
- **Ziems, Held, Shaikh, Chen, Zhang, Yang (2023/2024), Can Large Language Models Transform Computational Social Science?, Computational Linguistics.** 표본: 13개 모델, 25개 벤치마크. 분류에서는 최고 수준의 파인튜닝 모델을 넘지 못하지만 사람과 "fair" 수준 일치. 사람 팀 안의 보조 주석자 역할을 제안. [초록] — [arXiv](https://arxiv.org/abs/2305.03514).
- **Kristensen-McLachlan, Canavan, Kardos, Jacobsen, Aarøe (2023/2025), Are Chatbots Reliable Text Annotators? Sometimes, PNAS Nexus 게재 승인.** 표본: 미국 언론 트윗의 단순 이진 과제. 과제별 편차가 크고 DistilBERT 지도학습이 대체로 앞섬. [초록] — [arXiv](https://arxiv.org/abs/2311.05769).
- **Törnberg (2023), ChatGPT-4 Outperforms Experts and Crowd Workers in Annotating Political Twitter Messages with Zero-Shot Learning, arXiv.** 2020 미국 선거 정치인 트윗의 정당 분류에서 전문가·크라우드보다 정확도와 신뢰도가 높고 편향은 같거나 낮음. [초록] — [arXiv](https://arxiv.org/abs/2304.06588). 적용: 낙관적 사례. 단, 진짜 정답(발신자 소속)이 있어서 측정이 가능했다는 점이 우리와 다름.
- **Zhu, Zhang, Haq, Hui, Tyson (2023), Can ChatGPT Reproduce Human-Generated Labels?, arXiv.** 표본: 5개 데이터셋. 평균 정확도 0.609, 최고인 감성 분석도 64.9%, 라벨별 편차 큼. [초록] — [arXiv](https://arxiv.org/abs/2304.10145).
- **Alizadeh, Kubli, Samei, Dehghani, Zahedivafa, Bermeo, Korobeynikova, Gilardi 외 (2023), Open-Source LLMs for Text Annotation, arXiv.** 뉴스·트윗의 입장·주제·관련성 분류. 파인튜닝한 오픈소스 모델이 zero-shot GPT-3.5/4와 비슷하거나 앞섬. [초록] — [arXiv](https://arxiv.org/abs/2307.02179). 요청의 "Gilardi"는 이 논문의 공저자로 확인.
- **Rytting, Sorensen, Argyle, Busby, Fulda, Gubler, Wingate (2023), Towards Coding Social Science Datasets with Language Models, arXiv.** GPT-3가 일반적인 사람 코더와 비슷한 수준이며, 예시 3개 이하로도 일부 코더 간 일치도를 높임. [검색] — [arXiv](https://arxiv.org/abs/2306.02177).
- **Chae, Davidson (2025), Large Language Models for Text Classification, Sociological Methods & Research.** 표본: 10개 모델, 4개 학습 방식, 입장 탐지. 큰 모델이 대체로 최고 성능이지만 작은 모델의 파인튜닝도 경쟁력 있음. [초록] — [DOI](https://doi.org/10.1177/00491241251325243).
- **Qin, Zhang, Zhang, Chen, Yasunaga, Yang (2023), Is ChatGPT a General-Purpose NLP Task Solver?, arXiv.** 표본: 20개 데이터셋, 7개 과제군. 추론 과제는 강하지만 **sequence tagging 같은 과제는 어려움**. [초록] — [arXiv](https://arxiv.org/abs/2302.06476). 적용: 개체 추출이 분류보다 불리할 수 있다는 간접 근거.
- **Baumann, Röttger, Urman, Wendsjö, Plaza-del-Arco, Gruber, Hovy (2025), Large Language Model Hacking, arXiv.** 표본: 21개 연구 37개 과제 재현, 18개 LLM, 1,300만 라벨, 2,361개 가설. 최신 LLM도 가설의 약 31%에서, 작은 모델은 절반에서 잘못된 결론. 정확도가 높은 모델도 안전하지 않음. 21개 완화 기법 중 사람 주석이 거짓 양성 방어에 핵심. [초록] — [arXiv](https://arxiv.org/abs/2509.08825). 적용: 모델·프롬프트 선택만으로 평가 결론이 바뀔 수 있음.
- **Ludwig, Mullainathan, Rambachan (2024/2025), Large Language Models: An Applied Econometric Framework, NBER WP 33344.** 검증 표본이 없으면 LLM 오류를 평가할 수 없고, 사소해 보이는 모델·프롬프트 선택이 추정치를 크게 바꿈. [초록] — [arXiv](https://arxiv.org/abs/2412.07031), [NBER PDF](https://nber.org/system/files/working_papers/w33344/w33344.pdf).
- **Thapa, Shiwakoti, Shah, Adhikari, Veeramani, Nasim, Naseem (2025), Large language models (LLM) in computational social science: prospects, current state, and challenges, Social Network Analysis and Mining 15.** 리뷰 논문. 제3자 사본의 서지·초록만 확인했고 공식 페이지는 열지 못함. [검색] — [DOI](https://doi.org/10.1007/s13278-025-01428-9).
- **Megahed, Chen, Jones-Farmer, Lee, Wang, Zwetsloot (2025), Reliable Decision Support with LLMs, arXiv.** 표본: **금융 뉴스 1,350건**, 14개 LLM, 모델당 5회 반복. 동일 모델 내 완전 일치 90~98%, StockNewsAPI 라벨 대비 정확도 0.76~0.88, 작은 모델이 큰 모델을 앞서기도 함. 실제 시장 움직임 예측은 전부 우연 수준. [초록] — [arXiv](https://arxiv.org/abs/2505.14918). 적용: 도메인이 가장 가까운 논문. 다만 감성 이진 분류라 개체 목록 추출보다 쉬운 과제이고, 비교 기준도 사람이 아닌 외부 API 라벨.

### Inferences
- 우리 gold set은 "대체로 맞을 수 있다"고는 말할 수 있어도, 사람 기준 정확도는 측정된 적이 없다. 위 문헌 기준으로 현재 상태는 검증 전 단계다.
- 코드 규칙이 정밀도를 끌어올리는지 볼 때 Pangakis의 수치(정밀도 중앙값 0.650 < 재현율 0.829)처럼 LLM이 과잉 라벨 쪽으로 기울 수 있다는 점을 확인할 필요가 있다.

### Gaps
- **Bosley 외 "Do we still need BERT in the age of GPT"는 세 번의 검색에서 확인되지 않아 제외.** 제목이나 저자가 다를 수 있다.
- 한국어 금융 뉴스의 종목 추출을 사람 기준으로 평가한 논문은 이번 조사에서 찾지 못했다.

## 2. LLM끼리의 일치는 타당성을 과장하는가 (상관 오류, 모노컬처)

### Takeaway
그렇다는 직접 증거가 있다. 다른 제공사 모델 사이에서도 오류가 상관되며, 정확한 모델일수록 더 강하다. 따라서 0.947은 "독립된 두 번째 확인"으로 볼 수 없다.

### Cited Findings
- **Kim, Garg, Peng, Garg (2025), Correlated Errors in Large Language Models, ICML 2025.** 표본: 350개 이상 LLM, 리더보드 2개와 이력서 심사 과제. 한 리더보드에서 두 모델이 **모두 틀렸을 때 60% 같은 오답**(무작위 기준 1/3은 [검색] 수치). 같은 제공사·구조일수록 상관이 크지만, 크고 정확한 모델은 구조와 제공사가 달라도 강하게 상관. LLM-as-judge 평가에도 영향. [초록] — [arXiv](https://arxiv.org/abs/2506.07962), [PMLR](https://proceedings.mlr.press/v267/kim25e.html).
- **Hossain, Yousefi, Lim (2026), Agreement Overstates Evidence: Error Dependence in LLM Judge Consensus, arXiv.** 판정자 10개의 평균 오류 상관 0.21로, 정보량은 **독립 판정자 약 3.5개 수준**. 고성능 프런티어 모델은 제공사가 달라도 의존성이 더 강함. 비교의 최대 28%에서 공유 오류를 무시하면 "유의미하게 우수"로 잘못 판단. 소수의 신뢰 예시로 판정자 정확도와 공유 오류를 추정하라고 제안. [초록] — [arXiv](https://arxiv.org/abs/2609.22512). 적용: 이 상황과 가장 직접 맞는 논문. 2026년 9월 프리프린트로 동료 심사 여부는 미확인.
- **Lin (2026), Agreement Without Accuracy: Six Systematic Defects an LLM Annotation Study Could Not See in Its Own Reliability Statistics, SocArXiv.** 표본: 학생 UML 명세 1,902건. 파이프라인으로 일치도가 .647에서 .845로 올랐지만, 사전 블라인드 판독 40건 기준으로는 개선을 입증하지 못함. 자신이 쓴 감사 규칙도 블라인드 판독과 67.5%만 일치. [초록] — [EconPapers](https://econpapers.repec.org/RePEc:osf:socarx:n3zhf_v1). 적용: 코드 규칙으로 일치도가 올라간 것이 정확도 향상은 아니라는 경고. 저자 1인 프리프린트이고 도메인이 다름.
- **Soboroff (2024/2025), Don't Use LLMs to Make Relevance Judgments, Information Retrieval Research 1(1).** LLM이 정답 데이터를 쓰면 그 LLM이 평가의 성능 상한이 됨. [초록] — [arXiv](https://arxiv.org/abs/2409.15133), [DOI](https://doi.org/10.54195/irrj.19625). 적용: Claude가 만든 gold로 다른 LLM 파이프라인을 평가하면 "Claude와 닮은 정도"를 재는 셈.

### Inferences
- 설계상 판정자가 달라도 오류 독립을 가정할 수 없다. 공통 오류(기사에 명시되지 않은 수혜주, 지주사·자회사 혼동 등)는 겹침 점수에 나타나지 않는다. 구체적인 오류 유형은 이 조사에서 측정한 것이 아니라 가설이다.
- Hossain의 3.5는 표준 공식 `10/(1+9×0.21)=3.46`과 맞는다(직접 계산). 2개 판정자에 대입하면 상관 0.21에서 유효 개수 약 1.65개다. 이는 우리 모델 쌍의 실측값이 아닌 예시다.

### Gaps
- 개체명·회사 목록 추출 과제에서 LLM-LLM 일치와 사람 기준 정확도의 관계를 직접 잰 연구는 찾지 못했다. 위 근거는 객관식·판정 과제에서 나온 것이다.
- 요청의 "monoculture" 원전(Kleinberg & Raghavan)은 이번에 열어 확인하지 못해 목록에서 뺐다. Kim 외가 이론적 예측으로 언급한다는 점만 확인했다.

## 3. LLM 판정자의 편향과 정보검색 관련성 판정 논쟁

### Takeaway
판정자가 사람과 전체적으로 잘 일치해도 체계적 편향은 남는다. 전체 일치율만으로는 실패 패턴이 안 보인다는 것이 공통 지적이다. IR 분야는 찬반이 아직 갈린다.

### Cited Findings
- **Zheng 외 (2023), Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena, NeurIPS 2023 D&B.** GPT-4 판정자가 사람 선호와 80% 이상 일치(사람 간 일치와 동급). 위치·장황함·자기 향상 편향 확인. 3K 전문가 표, 30K 대화. [초록] — [arXiv](https://arxiv.org/abs/2306.05685).
- **Panickssery, Bowman, Feng (2024), LLM Evaluators Recognize and Favor Their Own Generations, NeurIPS 2024.** 사람이 동등하다고 본 글에서 LLM이 자기 출력을 더 높게 평가. 자기 인식 능력과 편향 강도가 선형 상관. [초록] — [arXiv](https://arxiv.org/abs/2404.13076). 적용: 같은 계열 모델로 판정하면 위험. 생성 글 평가 실험이므로 라벨 일치에는 간접 근거.
- **Liu, Moosavi, Lin (2023), LLMs as Narcissistic Evaluators, arXiv.** 요약 평가에서 언어 모델 기반 지표가 자기 모델 출력에 호의적이며, gold 없이 쓸 때 더 뚜렷함. [초록] — [arXiv](https://arxiv.org/abs/2311.09766).
- **Ye 외 (2024), Justice or Prejudice? Quantifying Biases in LLM-as-a-Judge, arXiv.** 12개 편향을 정량화하는 CALM 프레임워크. 고성능 모델도 일부 과제에서 유의한 편향. [초록] — [arXiv](https://arxiv.org/abs/2410.02736).
- **Thomas, Spielman, Craswell, Mitra (2023), Large language models can accurately predict searcher preferences, arXiv.** Bing 배포 경험. 실제 사용자 gold에 맞춘 프롬프트로 제3자 라벨러보다 좋은 라벨을 저비용으로 생성. 프롬프트의 단순 바꿔 쓰기도 정확도에 영향. [초록] — [arXiv](https://arxiv.org/abs/2309.10621). 적용: 찬성 쪽 대표 사례지만 **고품질 사람 gold를 전제**로 한다.
- **Faggioli 외 (2023), Perspectives on Large Language Models for Relevance Judgment, arXiv.** 사람-기계 협업 스펙트럼 제시, 완전 자동 판정 파일럿, 찬반과 절충 관점. [초록] — [arXiv](https://arxiv.org/abs/2304.09161).
- **Upadhyay, Pradeep, Thakur, Craswell, Lin (2024), UMBRELA, arXiv.** Thomas 외의 오픈소스 재현, GPT-4o, TREC 2019~2023 Deep Learning Track. [초록] — [arXiv](https://arxiv.org/abs/2406.06519).
- **Upadhyay 외 (2024), A Large-Scale Study of Relevance Assessments with LLMs: An Initial Look, arXiv.** TREC 2024 RAG, 19개 팀 77개 런. UMBRELA와 수동 판정의 시스템 순위가 높게 상관. 사람은 UMBRELA보다 엄격. LLM 보조가 상관을 더 높이지는 않음. [초록] — [arXiv](https://arxiv.org/abs/2411.08275). 적용: 낙관론의 최강 근거지만 **시스템 순위 상관**이지 개별 라벨 정확도가 아니고, 사람 판정과 비교해서 얻은 결과다.
- **Clarke, Dietz (2024), LLM-based relevance assessment still can't replace human relevance assessment, arXiv.** 위 주장 반박. 지표를 노린 시스템으로 점수를 부풀릴 수 있음을 시연하고, 순환성으로 순위가 왜곡됨을 시뮬레이션. [초록] — [arXiv](https://arxiv.org/abs/2412.17156). 적용: 평가 기준을 만든 LLM과 같은 방식으로 파이프라인을 튜닝하면 순환이 생김.
- **Alaofi, Thomas, Scholer, Sanderson (2024), LLMs can be Fooled into Labelling a Document as Relevant, SIGIR-AP 2024.** 전체 일치는 사람 간 수준이지만 LLM은 관련 있다고 더 자주 표시. 관련 없는 글에 질의어만 넣어도 속음. **전체 일치 지표는 중요한 실패 패턴을 놓침.** [초록] — [arXiv](https://arxiv.org/abs/2501.17969), [DOI](https://doi.org/10.1145/3673791.3698431). 적용: 기사에 회사명이 언급만 되어도 관련 종목으로 잡는 오류와 구조가 비슷하다(유사성은 내 추론).
- **Lau (2026), Same Input, Different Scores: A Multi Model Study on the Inconsistency of LLM Judge, arXiv.** GPT-4o, GPT-4o-mini, Gemini-2.5-Flash, Claude-Haiku-4.5, Claude-Sonnet-4.5. temperature 0에서도 점수 변동이 크고, 모델 간 엄격도가 체계적으로 다름. 낮은 temperature의 효과는 Anthropic 모델에서 제한적이거나 일관되지 않음. [초록] — [arXiv](https://arxiv.org/abs/2603.04417).
- **Schroeder, Wood-Doughty (2024), Can You Trust LLM Judgments? Reliability of LLM-as-a-Judge, arXiv.** McDonald's omega로 판정 신뢰도 평가. 고정 난수의 한계와 단일 샘플 평가의 위험을 보임. [초록] — [arXiv](https://arxiv.org/abs/2412.12509).

### Inferences
- 겹침 평균보다 **불일치 유형별 분석**(과잉 포함, 누락, 언급만 된 회사)을 먼저 보는 쪽이 이 문헌들의 교훈에 맞다.

### Gaps
- IR의 찬성 논문도 모두 사람 판정을 기준으로 삼는다. 사람 기준이 전혀 없는 상태를 정당화한 논문은 찾지 못했다.

## 4. 사람 표본은 얼마나 필요한가, 소수 사람 + 다수 LLM 라벨의 결합

### Takeaway
소규모 무작위 사람 표본과 LLM 라벨을 결합하면 LLM이 편향되어도 유효한 추정이 가능하다. 다만 이 방법들은 주로 "집계 지표 추정"용이며, 필요 건수를 일률적으로 정해 주지는 않는다.

### Cited Findings
- **Egami, Hinck, Stewart, Wei (2023), Using Imperfect Surrogates for Downstream Inference, NeurIPS 2023.** 정확도 80~90%의 대리 라벨도 그대로 쓰면 상당한 편향과 무효한 신뢰구간. DSL은 사람 라벨 표집 확률을 통제해 대리 라벨이 임의로 편향되어도 유효한 추론 보장. [초록] — [arXiv](https://arxiv.org/abs/2306.04746).
- **Angelopoulos, Bates, Fannjiang, Jordan, Zrnic (2023), Prediction-Powered Inference, Science.** 예측 모델에 대한 가정 없이 유효한 신뢰구간. 예측이 정확할수록 구간이 좁아짐. [초록] — [arXiv](https://arxiv.org/abs/2301.09633), [DOI](https://doi.org/10.1126/science.adi6000).
- **Angelopoulos, Duchi, Zrnic (2023/2026), PPI++: Efficient Prediction-Powered Inference, Annals of Applied Statistics.** 예측 품질에 자동 적응하고, 라벨 데이터만 쓴 고전적 구간보다 항상 개선. [초록] — [arXiv](https://arxiv.org/abs/2311.01453), [DOI](https://doi.org/10.1214/26-aoas2215).
- **Gligorić, Zrnic, Lee, Candès, Jurafsky (2024/2025), Can Unconfident LLM Annotations Be Used for Confident Conclusions?, NAACL 2025.** Confidence-Driven Inference. LLM 신뢰도로 사람 라벨 대상을 고르며, 3개 과제(공손성, 입장, 편향)에서 필요한 사람 라벨을 25% 이상 절감. [초록] — [arXiv](https://arxiv.org/abs/2408.15204), [DOI](https://doi.org/10.18653/v1/2025.naacl-long.179).
- **Zrnic, Candès (2024), Active Statistical Inference, arXiv.** 모델이 불확실한 지점에 라벨 예산을 우선 배정. 같은 표본 수로 더 좁은 신뢰구간. [초록] — [arXiv](https://arxiv.org/abs/2403.03208).
- **Pangakis 외 (2023)**: 무작위 250~1,250건, 희귀 범주는 더 필요. [본문] — [HTML](https://ar5iv.labs.arxiv.org/html/2306.00176).
- **Hanley, Lippman-Hand (1983), If Nothing Goes Wrong, Is Everything All Right? Interpreting Zero Numerators, JAMA 249(13).** n건에서 사건이 0건이면 95% 상한은 약 3/n(rule of three). [검색] — [Scilit](https://scilit.net/publications/ddfc523d905fccaecb8488227831d6ec).

### Inferences
- **10건 3회 일치의 통계적 한계**: 불일치 0/10이어도 95% 상한은 정확값 25.9%(3/n 근사 30%). 30건이면 9.5%, 100건이면 3.0%(직접 계산). 즉 "10건 모두 일치"는 불일치 기사가 최대 4분의 1 수준일 가능성을 배제하지 못한다.
- **0.947의 불확실성(거친 예시)**: 비율로 취급한 Wilson 95% 구간은 n=30에서 약 0.81~0.99, n=100에서 약 0.88~0.98(직접 계산). Dice는 기사 단위 비율이 아니므로 참고용이고, 정식으로는 기사 단위 부트스트랩이 맞다. 또한 이 구간은 판정자 간 일치의 불확실성일 뿐 정확도의 구간이 아니다.
- 100건 전수 사람 검수도 Pangakis 권고(250~1,250건)보다 적다. 다만 그 권고는 분류 과제 기준이며, 100건은 학습용 프로젝트의 "첫 측정"으로는 의미가 있다는 것이 내 판단이다.
- PPI/DSL의 전제는 **사람 라벨 대상의 무작위 또는 알려진 확률 표집**이다. 불일치 건만 사람이 보면 그 수치를 전체 정확도로 일반화할 수 없다.

### Gaps
- 개체 목록의 F1을 목표로 필요한 사람 표본 수를 직접 제시한 논문은 찾지 못했다.
- Baumann의 사람 라벨 권장 건수는 초록에 없고 본문은 확인하지 못했다.

## 5. 일치도 지표: kappa, alpha, F-measure, 유병률 역설

### Takeaway
NER처럼 음성 사례 수가 정의되지 않으면 kappa를 계산할 수 없고, F-measure를 일치도로 쓰는 것이 정당하다. 따라서 Dice 사용 자체는 옳다. 다만 F값은 kappa보다 높게 나오는 경향이 있고, 우연 보정은 없다.

### Cited Findings
- **Hripcsak, Rothschild (2005), Agreement, the F-Measure, and Reliability in Information Retrieval, JAMIA 12(3):296-298.** 음성 사례 수가 없으면 kappa 계산 불가. 균형 F-measure는 positive specific agreement와 동일. 음성 사례 d가 커지면 kappa는 F로 수렴. [본문] — [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC1090460/). 예시(a=40, b=c=10, F=0.80): d=10이면 κ=0.30, d=100이면 0.71, d=10,000이면 0.80. 이 표는 표준 Cohen's κ로 직접 재계산했으며 논문의 표가 아니다.
- **Artstein, Poesio (2008), Inter-Coder Agreement for Computational Linguistics, Computational Linguistics 34(4):555-596.** kappa, pi, alpha 계열 해설. 많은 주석 과제에 가중 alpha류가 더 적합하다고 논함. [검색] — [ACL Anthology](https://aclanthology.org/J08-4004/).
- **Deleger 외 (2012), Building Gold Standard Corpora for Medical Natural Language Processing Tasks, AMIA.** 개체 주석의 일치도를 F-measure로 보고(전체 0.8467~0.9176). [검색] — [서지](https://researchr.org/publication/DelegerLLKMSKMS12/authors). 적용: 사람 전문가의 개체 주석 일치가 이 수준이라는 비교 기준. 의료 도메인이고 사람 간 수치다. 이 논문의 kappa 값은 확인하지 못했다.
- **Feinstein, Cicchetti (1990), High agreement but low kappa: I / Cicchetti, Feinstein (1990), II, J Clin Epidemiol 43.** 주변 분포가 치우치면 일치율이 높아도 kappa가 낮아지는 역설. 해법으로 양성·음성 일치를 따로 보고. [검색] 서지와 내용은 인용 논문으로만 확인했고 PubMed 원문 페이지는 쿠키 차단으로 열지 못함 — [인용 논문](https://bmcmedresmethodol.biomedcentral.com/articles/10.1186/1471-2288-14-100).
- **Krippendorff alpha와 역설**: 두 평가자의 완전 명목 데이터에서는 kappa와 근사하며 유병률 역설이 옮겨 간다는 주장이 있지만, Gwet와 Krippendorff 사이에 논쟁 중이다. [검색] — [Gwet 논문](https://www.agreestat.com/papers/onkrippendorffalpha_rev10052015.pdf). 어느 한쪽을 확정된 결론으로 쓰면 안 된다.

### Inferences
- 보고 문구 제안: "0.947은 F1 동등의 positive specific agreement이며 우연 보정이 없고, 정확도가 아니라 두 LLM의 일치다." 종목 후보 사전이 닫혀 있으면 후보 전체를 음성으로 두고 kappa를 계산할 수는 있지만, 음성이 압도적으로 많아 F값에 수렴하므로(Hripcsak) 새 정보는 적다.
- 오히려 **기사당 평균이 아닌 합산 방식(micro/macro), 빈 목록 처리**에 따라 0.947이 달라질 수 있으니 계산 정의를 함께 적어야 한다. 빈 목록끼리 일치를 1로 치면 값이 올라간다. 우리 계산이 어떤지는 이 조사에서 확인하지 않았다.

### Gaps
- 요청의 "kappa가 NER에 부적절" 주제는 Hripcsak로 뒷받침되지만, 이를 정면으로 다룬 Brandsen 외 논문은 지표 정의를 확인하지 못해 제외했다.

## 6. 출력 비결정성, temperature 0의 한계, 반복 일관성, 투표

### Takeaway
temperature 0이나 seed 고정도 동일 출력을 보장하지 않는다. 7/7/1은 드문 현상이 아니다. 사후 처리로 최종 답을 일치시키는 것은 효과가 있지만, 일관성은 정확성의 필요조건일 뿐 증거가 아니다.

### Cited Findings
- **Ouyang, Zhang, Harman, Wang (2023/2024), An Empirical Study of the Non-Determinism of ChatGPT in Code Generation, ACM TOSEM.** 표본: 829개 문제. 요청 간 테스트 출력이 하나도 같지 않은 비율 75.76%, 51.00%, 47.56%. temperature 0은 기본값(1)보다 낫지만 결정성을 보장하지 않음. [초록] — [arXiv](https://arxiv.org/abs/2308.02828), [DOI](https://doi.org/10.1145/3697010). 적용: temperature 미설정이면 실행 환경의 기본값이 쓰임(모델별 기본값은 공식 문서로 별도 확인 필요).
- **Atil 외 (2024), Non-Determinism of "Deterministic" LLM Settings, arXiv.** 표본: 5개 LLM, 8개 과제, 10회. 정확도 변동 최대 15%, 최고-최저 격차 최대 70%. 원문 일치 TARr@N과 **파싱된 답 일치 TARa@N**을 구분. [초록] — [arXiv](https://arxiv.org/abs/2408.04667). 적용: "회사 수 불일치"는 원문 수준, "최종 종목 일치"는 파싱 후 수준이므로 두 지표를 나눠 보고하는 것이 좋다.
- **Song, Wang, Li, Lin (2024), The Good, The Bad, and The Greedy, arXiv.** 대부분 과제에서 greedy가 샘플링보다 우수, 단일 출력 평가는 변동을 놓침. [초록] — [arXiv](https://arxiv.org/abs/2407.10457). 적용: 낮은 temperature 설정의 근거.
- **Klishevich, Denisov-Blanch, Obstbaum, Ciobanu, Kosinski (2025), Measuring Determinism in Large Language Models for Software Code Review, arXiv.** 표본: 4개 모델, 70개 커밋, temperature 0, 5회. 그래도 응답이 달라짐. 이를 test-retest 신뢰도 문제로 규정. [초록] — [arXiv](https://arxiv.org/abs/2502.20747).
- **Reiss (2023), Testing the Reliability of ChatGPT for Text Annotation and Classification: A Cautionary Remark, arXiv.** 웹 텍스트의 뉴스/비뉴스 분류에서 동일 입력 반복이나 작은 문구 변경으로 결과가 달라지고, 신뢰도 기준에 못 미칠 수 있음. **반복 결과를 합치면 개선.** [초록] — [arXiv](https://arxiv.org/abs/2304.11085).
- **Wang 외 (2022/2023), Self-Consistency Improves Chain of Thought Reasoning in Language Models, ICLR 2023.** 여러 추론 경로를 샘플링해 다수결. GSM8K +17.9%, SVAMP +11.0%, AQuA +12.2%, StrategyQA +6.4%, ARC +3.9%. [초록] — [arXiv](https://arxiv.org/abs/2203.11171). 적용: 추론 과제의 결과이므로 추출에 같은 효과를 기대할 수는 없다.
- **Liu (2026), What Is Actually Being Annotated? Inter-Prompt Reliability, arXiv.** 해석적 과제는 프롬프트별 변동이 크고 지식 기반 과제는 안정적. 프롬프트 간 다수결로 재현성 향상. GPT-4o mini의 PAR이 k=1의 0.71에서 k=5의 약 0.9, k=10의 0.95로 상승([검색] 수치). 저자는 **투표가 정확성을 보장하지 않으며 체계적 편향을 고착시킬 수 있다**고 경고. [초록] — [arXiv](https://arxiv.org/abs/2604.16413).
- **Elumar, Tekin, Yagan (2025), Cost-aware LLM-based Online Dataset Annotation, NeurIPS 2025.** 인스턴스별로 LLM 일부만 선택한 가중 다수결. MMLU·IMDB에서 전체 다수결과 비슷하거나 나은 정확도에 비용 절감. [초록] — [arXiv](https://arxiv.org/abs/2505.15101).
- **Geng 외 (2025), JSONSchemaBench, arXiv.** 1만 개 실제 JSON 스키마로 6개 제약 디코딩 프레임워크 평가. [초록] — [arXiv](https://arxiv.org/abs/2501.10868). 적용: 구조화 출력은 **형식**을 보장할 뿐, 어떤 회사를 뽑을지의 일관성을 보장한다는 근거는 아니다(이 해석은 내 추론).
- **Elazar 외 (2021), Measuring and Improving Consistency in Pretrained Language Models, TACL.** 328개 바꿔 쓰기, 38개 관계. 의미가 같은 입력에 대한 일관성이 전반적으로 낮음. [초록] — [arXiv](https://arxiv.org/abs/2102.01017).
- **Raj, Rosati, Majumdar (2022), Measuring Reliability of Large Language Models through Semantic Consistency, arXiv.** 어휘 일치 대신 의미 일관성 지표 제안. [초록] — [arXiv](https://arxiv.org/abs/2211.05853).
- **Piccioli, Fidelangeli, Santin, Vivo (2026), From Judgments to Issues: Structured Extraction of Legal Reasoning, arXiv.** DeepSeek V3, 전문가 2인 검증 50건. 사람 간 쟁점 F1 88.1%, 인용 F1 97.1%(N=20). LLM-전문가 쟁점 F1 72.7~87.9%, 인용 F1 71.5~77.1%. temperature 0과 seed 고정에서도 비결정적. [본문 일부] — [HTML](https://arxiv.org/html/2607.03325). 실행 간 F1(쟁점 78.3%, 인용 73.2%)은 검색 요약에만 있고 Appendix H를 직접 확인하지 못함 [검색]. 적용: **구조화 추출에서 저가 모델이 사람 간 일치보다 낮을 수 있다는, 도메인은 달라도 과제가 가까운 근거.** 코드 필터(Linkoln 대조)로 후처리한 구조도 우리와 유사하다.

### Inferences
- 7/7/1은 Atil 외의 "원문 수준 변동"에 해당하고, 코드 규칙 후 일치는 "파싱 후 일치"에 해당한다. 후처리가 흡수한 변동과, 후처리로도 못 고치는 공통 누락을 구분해야 한다. 특히 1개만 나온 실행이 최종 목록에 영향을 주지 않았다면, 규칙이 뒤집어 맞춘 것인지 해당 기사가 표본에 없었던 것인지 확인할 가치가 있다. 10건에 그 기사가 포함됐는지는 이 조사에서 확인하지 않았다.
- temperature 명시는 비용이 거의 없고 여러 논문에서 변동을 줄였으므로 합리적이다. 다만 Lau에 따르면 일부 모델에서 효과가 제한적이어서 재측정이 필요하다.
- Pangakis의 일관성-정확도 관계(+19.4%p)로 볼 때 반복 불일치 기사를 사람 검수 우선 대상으로 삼는 것이 근거가 있다. 단 이것은 위 4절의 무작위 표본과 별도로 운영해야 한다.

### Gaps
- **배치 불변성 설명(Thinking Machines, "Defeating Nondeterminism in LLM Inference")**: 원문 접속 실패(DNS)로 2차 자료만 확인했다. 논문이 아닌 블로그이며 수치(1,000회 중 80종 출력 등)는 원문 대조 전에 인용하지 말 것.
- nano급 저가 모델의 추출 반복 일관성을 직접 잰 연구는 찾지 못했다. 사용 중인 모델의 seed 지원 여부는 공식 문서로 확인이 필요하다.

## 7. 재현성: 모델 버전 드리프트

### Takeaway
같은 이름의 서비스도 몇 달 사이 동작이 크게 바뀐다. 평가 결과는 측정 시점의 모델 스냅샷과 묶어 기록해야 한다.

### Cited Findings
- **Chen, Zaharia, Zou (2023), How is ChatGPT's behavior changing over time?, arXiv.** 2023년 3월과 6월 비교. GPT-4 소수 판별 84.0%→51.1%, GPT-3.5는 49.6%→76.2%. GPT-4 바로 실행 가능한 코드 생성 52.0%→10.0%. 답 추출 지시 준수 99.5%→0.5%. [본문] — [arXiv](https://arxiv.org/abs/2307.09009), [HTML](https://arxiv.org/html/2307.09009). 적용: 지시 준수와 형식의 변화는 파서와 코드 규칙을 깨뜨릴 수 있다.
- **Baumann 외 (2025)**, **Ludwig 외 (2024)**: 모델·프롬프트 선택만으로 결론이 달라짐(1절). [초록] — [Baumann](https://arxiv.org/abs/2509.08825), [Ludwig](https://arxiv.org/abs/2412.07031).
- **Thomas 외 (2023)**: 단순 바꿔 쓰기도 정확도에 영향. [초록] — [arXiv](https://arxiv.org/abs/2309.10621).

### Inferences
- 고정 스냅샷 ID, 프롬프트 버전, 파라미터, 실행일을 gold와 평가 결과에 함께 남기는 것이 최소 조치다. 모델 교체 시 gold 일부로 회귀 측정을 다시 해야 한다.

### Gaps
- Chen 외는 2023년 GPT 한정이다. 현재 제공사들의 날짜 고정 스냅샷이 드리프트를 얼마나 막는지 정량 연구는 찾지 못했다.
