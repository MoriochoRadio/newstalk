# 기업 엔티티 링킹과 엔티티 현저성(salience): 종목 매칭 로직 근거 논문

조사일: 2026-11-05

**확인 수준 표기** (모든 논문은 페이지 또는 검색 결과로 존재를 확인했다. 기억만으로 쓴 인용은 없다.)
- **[A1]** PDF를 내려받아 원문 텍스트를 직접 읽음. 표의 숫자를 직접 확인.
- **[A2]** arXiv HTML 본문을 읽었으나 요약 모델을 거침. 숫자는 맞을 가능성이 높지만, 인용 전 원문 표 대조 권장.
- **[B]** 초록·서지 페이지만 확인. 본문 숫자 없음.
- **[C]** 검색 결과 스니펫으로만 확인. 원문 접근이 실패함(403, 503, DNS, 봇 차단). **숫자·내용은 미검증으로 취급.**

**도메인 표기**: 별도 표시가 없으면 전부 **영어**다. 한국어 주식 뉴스에서 측정된 수치는 이번 조사에서 하나도 찾지 못했다.

---

## 1. 금융·뉴스 텍스트의 기업명 중의성 해소와 엔티티 링킹: 어떤 방법이 어느 정도 정확한가

### Takeaway
금융 도메인에서 공개 벤치마크로 방법들을 공정하게 비교한 연구는 찾지 못했고, 수치는 대부분 비공개 KB 위의 자체 평가다. 다만 "문자열 매칭만으로는 동명 기업을 못 가른다"는 점과, 일반 벤치마크에서 단순 사전 기반 baseline(Prior)이 생각보다 강하다는 점(평균 F1 0.754 vs 최고 LLM 방식 0.795)은 함께 확인된다.

### Cited Findings

**금융·기업 특화**

- **JEL: Applying End-to-End Neural Entity Linking in JPMorgan Chase** — Ding, Chaudhri, Chittar, Konakanchi. arXiv 2411.02695(2024 게시). 검색 결과에 AAAI 페이지도 나오지만 봇 차단으로 게재 정보는 미확인. [A2] [arXiv](https://arxiv.org/html/2411.02695v1) / 도메인: 영어 금융 뉴스, 비공개 KG
  - 데이터: mention-entity 쌍 586,975개(양성 293,949, 음성 293,026), 80/10/10 분할. KB는 "수백만" 개체라고만 공개.
  - 결과(F1): JEL 0.9991, SVM-Rank 0.9652, LR 0.8801, Tri-gram cosine 0.8768, ENEL 0.8656, Bi-gram cosine 0.8402, Cosine Context 0.6639, Jaccard Context 0.5554.
  - 문자열 유사도는 이름이 같거나 비슷한 다른 기업을 분리하지 못한다고 명시(Lumier 사례).
  - **주의**: 쌍(pair) 단위 이진 분류이고, 라벨 일부가 bi-gram cosine 임계값(0.5, 0.75)으로 생성됐다. 0.9991은 실서비스 링킹 정확도로 읽으면 안 된다.
- **Isaac Bloomberg Meets Michael Bloomberg: Better Entity Disambiguation for the News** — WWW 2015 Companion. [C] [PDF](https://archives.iw3c2.org/www2015/documents/proceedings/companion/p631.pdf), [AMiner](https://www.aminer.cn/pub/5736977f6e3b12023e6659f6/isaac-bloomberg-meets-michael-bloomberg-better-entity-disambiguation-for-the-news) / 도메인: 영어 뉴스
  - 스니펫 기준: 위키피디아 없이 Bloomberg News 코퍼스로 특징을 만들고, 사람·기업 500만 개 이상의 자체 KB에 링킹. 저자와 정밀도·재현율 수치는 미확인.
- **Building an Authority-Driven Company Tagging and Resolution System (Newton)** — Thomson Reuters 연구진. [C] [O'Reilly](https://www.oreilly.com/library/view/working-with-text/9781780634302/B978184334749100007X.xhtml) / 도메인: 영어 Reuters 뉴스
  - 스니펫 기준: 기사 속 기업명을 권위 DB(authority DB)에 연결. 사전(권위 DB) 기반 구조가 산업계에서 쓰인 사례. 성능 수치는 미확인.
- **Recognyze** — WIMS 2014. [C] [PDF](https://eprints.weblyzard.com/77/13/wims2014.pdf) / 도메인: 스위스 경제 뉴스(NZZ, AWP)로 평가했다는 스니펫 내용만 확인. 저자·수치 미확인.
- **Disambiguation of Company names via Deep Recurrent Networks** — Basile, Crupi, Grasso, Mercanti, Regoli, Scarsi, Yang, Cosentini. arXiv 2023, Expert Systems with Applications 238(C), 2024. [B] [arXiv](https://arxiv.org/abs/2303.05391)
  - Siamese LSTM이 라벨이 충분할 때 표준 문자열 매칭 benchmark를 능가. 초록에 수치 없음. 문맥 없이 **이름 문자열 쌍**만 비교한다.
- **Company Mention Detection for Large Scale Text Mining** — Passonneau, Ramelson, Xie. KDIR 2014. [C] [SciTePress](https://www.scitepress.org/Papers/2014/51744/) / 도메인: 영어 금융 뉴스
  - 스니펫 기준: 기업 언급 탐지가 나아져도 뉴스 기반 주가 예측이 반드시 좋아지지는 않는다고 언급.

**LLM 추출 + 사전 대조: 우리 구조와 가장 가까운 논문**

- **Extracting Structured Insights from Financial News: An Augmented LLM Driven Approach** — Dolphin, Dursun, Chow, Blankenship, Adams, Pike. arXiv 2407.15788, 2024. [A2] [arXiv](https://arxiv.org/html/2407.15788) / 도메인: 영어 금융 뉴스(2023), 미국 시장
  - 데이터: 5,530개 기사(공개), 6개 제공사, 기업명-티커 42,000쌍 이상의 표.
  - 구조: LLM이 기업/티커를 추출한 뒤 표로 검증. 실패 시 Levenshtein, 최장 공통 부분열, 공통 단어 수로 퍼지 매칭 후 LLM이 재확인. 그래도 실패하면 버림.
  - 결과: 제공사 태그 대비 누락 없는 기사 90%, 추가 티커가 있는 기사 22%(대부분 GOOG/GOOGL 같은 다른 주식 종류 추가).
  - LLM 환각 사례 보고(Pfizer를 PFI로 출력, 정답 PFE). 환각률은 미보고. 티커 생성이 이름 추출보다 위험하다고 주장.
  - 퍼지 매칭은 Google→Alphabet처럼 비직관적 대응에 실패해 수동 표가 필요.
  - **주의**: 정답이 사람 라벨이 아니라 제공사 태그이고, 정밀도는 보고되지 않았다.
- **Financial Named Entity Recognition: How Far Can LLM Go?** — Lu, Huo. arXiv 2501.02237, 2025. [A2] [arXiv](https://arxiv.org/html/2501.02237v1) / 도메인: 영어 금융 뉴스 FiNER-ORD 201건
  - Weighted F1: LLM 0.75~0.84(최고 Gemini-1.5-flash CoT 0.8369), 파인튜닝 BERT 0.8744, RoBERTa 0.8792.
  - LLM 오류 유형: 고유명사 문맥 오해 31.3%, 대명사·일반 명사 26.3%, 개체 누락 21.4%.
- **FinEntity: Entity-level Sentiment Classification for Financial Texts** — Tang, Yang, Huang, Tam, Tang. EMNLP 2023. [C, 서지는 검색 결과의 ACL Anthology 항목] [ACL](https://aclanthology.org/2023.emnlp-main.956) / 도메인: 영어 Reuters 시퀀스 4,000개
  - 한 텍스트 안의 여러 금융 개체가 서로 반대 감성을 가질 수 있음을 다룬 데이터셋. 다중 기업 기사가 실제 문제임을 보여 주는 근거. 수치는 원문 미확인.

**일반 벤치마크의 단순 baseline**

- **Prior(위키피디아 앵커 사전 + 최빈 개체)** — ChatEL 논문 내 baseline. [A1] [ACL](https://aclanthology.org/2024.lrec-main.275.pdf) / 도메인: 영어 위키피디아 엔티티
  - 10개 벤치마크 평균 micro-F1: Prior 0.754, REL 0.768, End2End 0.770, GENRE 0.725, ReFinED 0.773, ChatEL 0.795. 수행 조건은 mention이 이미 주어진 disambiguation 전용이다.
  - 뉴스 계열 데이터(ACE04 0.863, MSNBC 0.903)에서 Prior가 특히 강함.

### Inferences
- "이름 사전 대조"는 근거 없는 단순화가 아니다. 영어 위키피디아 벤치마크 기준으로 Prior는 최고 수준과 4점 차이다. 단 Prior는 위키피디아 링크 통계를 쓰므로 우리 사전과 다르다.
- 우리 서비스는 "모호한 별칭 제외"로 가장 어려운 문제(동명 기업)를 **풀지 않고 피한다**. JEL이 말하는 문자열 매칭의 한계를 정밀도 면에서는 우회하지만, 제외된 별칭에서 재현율 손실이 생긴다. 이 트레이드오프를 측정한 논문은 찾지 못했다.
- Dolphin 구조와 비교하면 우리는 퍼지 매칭 단계가 없다. 오연결은 줄지만 표기 변형 누락은 늘어날 수 있는 방향이다. 내부 테스트의 "오연결 건수"만으로는 이 손실이 드러나지 않는다.

### Gaps
- 금융 기업 링킹의 **공개 표준 벤치마크**를 찾지 못했다. 논문 간 수치 비교는 불가능하다.
- 정확 일치 vs 퍼지 vs 임베딩 vs LLM을 같은 금융 데이터에서 직접 비교한 논문을 찾지 못했다.
- "모호한 별칭 제외" 방식을 평가한 논문을 찾지 못했다.
- Bloomberg 2015, Newton, Recognyze, Passonneau는 원문 접근 실패로 수치 미확인.

---

## 2. LLM 기반 엔티티 링킹: LLM이 직접 생성 vs 검색된 후보를 LLM이 고르기

### Takeaway
**문헌은 한쪽으로 정리되지 않고 갈린다.** LLMAEL은 후보 재순위화가 직접 생성보다 대체로 나쁘다고 보고하고, ChatEL·DeepEL·LELA는 후보 선택형 LLM이 최고 성능이라고 보고한다. 차이는 후보에 설명을 붙였는지, "해당 없음" 선택지가 있는지, 모델 크기, 후보 재현율에서 나오는 것으로 보인다. 내부 결과(후보 방식 12건 vs 추출 후 매칭 4건 오연결)는 LLMAEL 쪽과 방향이 같지만, 일반 결론의 근거는 되지 못한다.

### Cited Findings

**재순위화에 불리한 근거**

- **LLMAEL: Large Language Models are Good Context Augmenters for Entity Linking** — Xin, Qi, Yao, Zhu, Zeng, Bin, Hou, Li. CIKM 2025, arXiv 2407.04020. [A1] [arXiv](https://arxiv.org/abs/2407.04020), [DOI](https://doi.org/10.1145/3746252.3761156) / 도메인: 영어 위키피디아 엔티티
  - Table 5(정확도, 순서대로 AIDA / MSNBC / AQUAINT / ACE04):
    - BLINK 단독 82.01 / 86.23 / 85.16 / 86.01
    - LLM 단독 78.37 / 80.49 / 73.18 / 83.27
    - 재순위화 100후보 70.95 / 82.01 / 73.18 / 74.32
    - 재순위화 10후보 + 위키 초록 73.24 / 80.18 / 73.45 / 82.88
  - 재순위화 LLM은 Llama-3-70b. 논문은 재순위화가 성능을 높이지 못한다고 결론. 원인 두 가지: **비슷한 후보 이름이 LLM을 혼란시킴**, 후보를 여럿 주면 **멘션 대신 전체 문맥으로 주의가 분산됨**.
  - **MSNBC와 AQUAINT에서는 재순위화가 LLM 단독과 비슷하거나 약간 높다.** "항상 나쁘다"는 아니다.
  - 또한 **전용 EL 모델(BLINK)이 LLM 단독, 재순위화보다 모두 높다.** 논문의 주 결론은 LLM을 문맥 보강에 쓰는 방식이 최선이라는 것(저자 자체 평가: ReFinED 85.46 → 86.67).
  - 오류 분석: LLM 설명이 다른 개체로 표류하는 경우 14% 등 LLM 쪽 오류도 보고.

**후보 선택형에 유리한 근거**

- **ChatEL: Entity Linking with Chatbots** — Ding, Zeng, Weninger. LREC-COLING 2024, pp. 3086-3097, arXiv 2402.14858. [A1] [ACL](https://aclanthology.org/2024.lrec-main.275.pdf) / 도메인: 영어 위키피디아, 10개 벤치마크(문서 20~357건)
  - 구조: Prior + BLINK로 후보 10개, LLM이 보조 문맥 생성, 객관식 선택에 "None of the entity match" 포함.
  - 평균 micro-F1 0.795(2위 ReFinED 0.773). KORE50, Reuters-128, RSS-500에서 16.9, 9.2, 6.6점 상승. 후보가 모두 맞을 때의 상한(Gold-F1) 평균 0.932.
  - BLINK 후보 추가가 6개 벤치마크에는 도움이지만 OKE15와 AQUAINT에서는 **노이즈로 성능을 낮춤**.
  - 오류 분석에서 정답 라벨 자체가 틀린 사례가 많다고 보고(AIDA-CoNLL 등 최소 5% 오류 인용).
- **Harnessing Deep LLM Participation for Robust Entity Linking (DeepEL)** — Hou, Zhang, Meng. arXiv 2511.14181, 2025. [A2] [arXiv](https://arxiv.org/html/2511.14181v1) / 도메인: 영어 위키피디아
  - 평균 F1: DeepEL 0.8250, ChatEL 0.7987, BLINK 0.7702, ReFinED 0.7493, REL 0.7338, GENRE 0.7150.
  - 후보 생성에 LLM 해석 추가 제거 시 0.7990, 자기 검증 제거 시 0.8147. 전문 도메인 내 데이터에서는 전용 모델을 늘 이기지는 못함.
  - ChatEL 프롬프트를 바꿨더니 원 논문과 결과가 크게 달라졌다고 보고. **LLM EL 수치가 프롬프트에 민감하다는 근거.**
- **LELA: an LLM-based Entity Linking Approach with Zero-Shot Domain Adaptation** — Haffoudhi, Suchanek, Holzenberger. arXiv 2601.05192, 2026. [A2] [arXiv](https://arxiv.org/html/2601.05192) / 도메인: 영어 다중 도메인(ZESHEL, GLADIS, ESCO, ZELDA)
  - 후보 생성 → 점별 재순위화 → 추론 LLM이 선택. ZESHEL 83.11 vs BLINK 74.27.
  - 재순위화 단독은 최선 후보를 못 찾는다고 주장. 이득은 **후보를 함께 놓고 추론하는 선택 단계**에서 나옴. 작은 모델은 재순위화 제거 시 크게 하락(Qwen3-4B 68.00→62.09), 큰 모델은 거의 영향 없음(Magistral 83.10 vs 83.11).
  - ESCO에서는 무조건 UNK 예측(44.57)이 모든 시스템을 이김. 후보 밖 정답이 많으면 선택형이 약해진다.
- **OneNet: A Fine-Tuning Free Framework for Few-Shot Entity Linking via Large Language Model Prompting** — Liu, Liu, Zhang, Wang, Liu, Chen. arXiv 2410.07549, 2024. [A2] [arXiv](https://arxiv.org/html/2410.07549v1) / 도메인: 영어 위키피디아 등
  - Micro-F1: AIDA 0.690 vs 최고 baseline 0.575, MSNBC 0.796 vs 0.732.
  - LLM 후보 필터의 정답 재현율 약 0.77~0.88. 논문 스스로 이 단계가 전체 성능 상한을 정한다고 인정. 맥락 추론이 틀리면 CoT가 오히려 오도한다고 보고.
- **GenDecider: Integrating "None of the Candidates" Judgments in Zero-Shot Entity Linking Re-ranking** — Zhou, Li, Wang, Qiao, Li. NAACL 2024(short), pp. 239-245. [B] [ACL](https://aclanthology.org/2024.naacl-short.22/) / 도메인: ZESHEL
  - 정답이 후보에 없는 경우를 기존 재순위화가 자주 놓친다는 점을 문제로 다룸.
- **NASTyLinker: NIL-Aware Scalable Transformer-based Entity Linker** — Heist, Paulheim. ESWC 2023, arXiv 2303.04426. [B] [arXiv](https://arxiv.org/abs/2303.04426)
  - KB에 없는 개체(NIL) 처리 문제. 비상장사 이름이 기사에 흔한 우리 상황과 개념적으로 연결된다. 초록에 수치 없음.

**LLM 이전의 기준 모델**

- **Scalable Zero-shot Entity Linking with Dense Entity Retrieval (BLINK)** — Wu, Petroni, Josifoski, Riedel, Zettlemoyer. EMNLP 2020, pp. 6397-6407. [C] [arXiv](https://arxiv.org/pdf/1911.03814) / bi-encoder 검색 후 cross-encoder 재순위화. 스니펫 기준 zero-shot 벤치마크에서 6점 상승.
- **Autoregressive Entity Retrieval (GENRE)** — De Cao, Izacard, Riedel, Petroni. ICLR 2021. [C] [arXiv](https://arxiv.org/abs/2010.00904) / 개체 **이름을 생성**하는 방식. LLM이 이름을 내고 코드가 대조하는 우리 구조와 발상이 가장 가까운 선행 연구.
- **ReFinED: An Efficient Zero-shot-capable Approach to End-to-End Entity Linking** — Ayoola, Tyagi, Fisher, Christodoulopoulos, Pierleoni. NAACL 2022 Industry. [B] [arXiv](https://arxiv.org/abs/2207.04108) / 평균 3.7 F1 개선, 60배 이상 빠름. 위키데이터(위키피디아의 약 15배 개체)로 확장.
- **Bootleg: Chasing the Tail with Self-Supervised Named Entity Disambiguation** — Orr, Leszczynski, Arora, Wu, Guha, Ling, Ré. arXiv 2010.10363, 2020. [B] [arXiv](https://arxiv.org/abs/2010.10363) / 드문(tail) 개체 문제. 시총 하위 종목에 해당하는 문제 구조.

### Inferences
- 내부 결과는 LLMAEL의 메커니즘(비슷한 후보 이름 혼동, 주의 분산)과 잘 맞는다. 한국 종목명은 "삼성전자/삼성SDI/삼성물산"처럼 비슷한 이름이 많아 설명력이 있어 보이지만, **이 연결은 추론이며 한국어로 검증된 적은 없다.**
- 반대 근거의 공통 설계 요소는 후보별 설명, "해당 없음" 선택지, 문맥 보강이다. 내부 후보 방식에 이것들이 있었는지가 12 vs 4의 해석을 좌우한다. 없었다면 "후보 방식 일반"이 아니라 "단순 후보 나열"에 대한 결과다.
- 28건, 오연결 수만 비교한 결과는 재현율을 재지 않았고 표본도 작다. LLM EL 수치의 프롬프트 민감도(DeepEL)와 라벨 오류(ChatEL)를 고려하면, "방향성 근거"까지만 말할 수 있다.
- 우리 작업은 표준 EL과 다르다. 표준 EL은 멘션이 주어진 상태에서 위키피디아 수백만 개체를 고르지만, 우리는 **문서 단위로 2,655개 닫힌 목록**에 대응한다. 위 논문들의 수치를 그대로 옮길 수 없다.

### Gaps
- 금융 또는 한국어에서 "LLM 추출 후 코드 대조 vs 후보 제시 후 LLM 선택"을 직접 비교한 논문을 찾지 못했다.
- 닫힌 소규모 목록(수천 개)에서의 LLM EL 성능 연구를 찾지 못했다.
- ChatEL 등 수치는 GPT-3.5/4 시대 모델이다. 최신 모델 기준의 독립 재현은 확인하지 못했다.

---

## 3. 한국어 NER·엔티티 링킹, 한국어 금융

### Takeaway
한국어 금융 뉴스를 상장 종목에 링킹하는 논문은 **찾지 못했다**. 한국어 일반 EL과 금융 NER은 있으나 수가 적고, 표준 벤치마크가 없다.

### Cited Findings
- **KorBERT와 Popularity 정보에 기반한 한국어 개체연결** (Korean Entity Linking based on KorBERT and Popularity) — 허정, 배경만, 임수종(ETRI). 제34회 한글 및 한국어 정보처리 학술대회, 2022. [A1, 한글 추출 일부 실패] [PDF](https://koreascience.kr/article/CFKO202226455348172.pdf) / 도메인: 한국어 위키피디아 계열
  - 영문 저자명과 숫자는 확인: F1 개선폭 0.0312와 0.1106, Hybrid Acc 0.8911과 0.793, F1 0.7617과 0.6784. **PDF 폰트 문제로 한글 라벨이 사라져, 어느 숫자가 어느 조건인지 확인하지 못했다.** 인용 전 원문 대조 필요.
  - 하이퍼링크, 인링크, 문서 길이로 만든 인기도(popularity) 특징을 KorBERT와 결합.
- **Entity Linking Korean Text: An Unsupervised Learning Approach using Semantic Relations** — Kim, Choi. CoNLL 2015, pp. 132-141, DOI 10.18653/v1/K15-1014. [B] [ACL](https://aclanthology.org/K15-1014/)
  - 검색 스니펫 기준: 한국어 EL에 적절한 골드 표준 데이터셋이 없다고 지적, Kim et al.(2014)의 단순화 과제 F1 75.66% 인용. 2015년 시점 내용이며 [C] 수준.
- **Constructing a Korean Named Entity Recognition Dataset for the Financial Domain using Active Learning** — Jeong, Heo, Kim, Park. ICON 2020, pp. 208-212. [B] [ACL](https://aclanthology.org/2020.icon-main.27/) / 도메인: **한국어 금융**
  - 8,043문장, 인식기 성능 80.84%, 구축 비용 12~25% 절감. 링킹이 아니라 NER이다.
- **뉴럴 텐서 네트워크 기반 주식 개별종목 지식개체명 추출 방법에 관한 연구** — 양윤석, 이현준, 오경주. 지능정보연구 25(2), 2019, pp. 25-38. [B] [KoreaScience](https://koreascience.kr/article/JAKO201919163609754.page?lang=en) / 도메인: **한국어, 종목**
  - 상위 30개 종목 애널리스트 리포트 5,600건(학습 3,074, 평가 2,526), 적중률 69.3%. LG전자, 기아차, 만도에서 낮음(유사 항목 간섭, 새로운 지식 등장). 뉴스 링킹이 아니라 "개체가 어느 종목과 관련되는가"를 다룸. 국내 연구 중 주제가 가장 가깝다.
- **KF-DeBERTa: Financial Domain-specific Pre-trained Language Model** — Jeon, Kim, Song, Ryu(카카오뱅크·FnGuide). 제35회 한글 및 한국어 정보처리 학술대회, 2023, pp. 143-148. [C, 모델 카드] [HF](https://huggingface.co/kakaobank/kf-deberta-base) / 도메인: **한국어 금융**
  - 금융 NER(FN-NER), 금융 광고성 뉴스 분류(FN-Adnews) 평가 포함. 광고성 뉴스 분류 벤치마크가 있다는 점은 기사 유형 필터와 연결된다. 논문 원문 미확인.
- **Generalized Stock Price Prediction for Multiple Stocks Combined with News Fusion** — Liao, Lee, Cheng, Chen, Lee, Wang. arXiv 2603.19286, 2026. [A2] [arXiv](https://arxiv.org/html/2603.19286v1) / 도메인: 대만 중국어 뉴스(6개 종목, 하루 약 220건)
  - 인접 언어권 사례. 종목명 임베딩 어텐션으로 뉴스를 가중해 MAE 7.11% 감소(LLaMA, TW21). 목적이 주가 예측이라 링킹 정확도 자체는 평가하지 않는다.

### Inferences
- 영어 근거를 한국어로 옮길 때 추가로 고려할 점은 한국어 조사 결합, 기업 약칭, 그룹사 이름의 유사성이다. 위 영어 수치가 이것을 반영하지 않는다는 점은 확실하지만, 한국어에서 얼마나 달라지는지는 근거가 없다.
- 우리 서비스의 2,655종목 매칭은 국내 공개 연구 범위 밖에 있다. 내부 평가가 사실상 유일한 직접 증거다.

### Gaps
- KCI, RISS, DBpia를 직접 검색하지 못했고, 웹 검색과 KoreaScience로만 확인했다. **국내 논문 누락 가능성이 크다.** 특히 학위 논문과 DBpia 전용 논문.
- 한국어 뉴스의 엔티티 현저성(salience) 연구는 찾지 못했다.

---

## 4. 엔티티 현저성: 제목·리드 위치와 언급 빈도는 얼마나 예측력이 있는가

### Takeaway
**"첫 위치 + 빈도" baseline은 강하다.** NYT 11만 건 기준 위치와 빈도만으로 F1 60.3을 얻고, 모든 특징을 더해도 62.0이다. 다만 학습된 트랜스포머는 F1 82까지 올라가므로, 규칙이 최선이라는 뜻은 아니다. **빈도는 짧은 문서에서 오히려 해롭다**는 보고가 있고, 제목만의 독립 기여도를 분리한 수치는 거의 없으며, 우리 가중치(.40/.20/.25/.25/.10)를 지지하는 문헌은 찾지 못했다.

### Cited Findings

**위치 + 빈도의 강함**

- **A New Entity Salience Task with Millions of Training Examples** — Dunietz, Gillick. EACL 2014, pp. 205-209. [A1] [ACL](https://aclanthology.org/E14-4040/) / 도메인: 영어 NYT, 라벨은 "요약문에 등장하는 개체"
  - 테스트 9,719건, 학습 데이터 10만 건 이상, 200만 개 이상 라벨.
  - 특징을 누적 추가한 Table 3(현저 클래스 P / R / F1):
    - 항상 비현저로 예측: F1 23.9
    - 첫 문장 baseline: 59.5 / 37.8 / 46.2
    - head-count 단독: 37.3 / 54.7 / 44.4
    - mentions 단독: 57.2 / 51.3 / 54.1
    - 1st-loc: 46.1 / 60.2 / 52.2
    - + head-count: 52.6 / 63.4 / 57.5
    - + mentions: 59.3 / 61.3 / **60.3**
    - + headline: 59.1 / 61.9 / 60.5
    - + head-lex: 59.7 / 63.6 / 61.6
    - + centrality: 60.5 / 63.5 / **62.0**
  - **제목 관련 특징(멘션 단어의 제목 등장 여부와 품사)을 더해도 F1은 0.2만 상승.** 단 위치·빈도가 이미 들어간 뒤의 **한계 기여**이고, 제목 등장 여부를 단독으로 평가한 것이 아니며 특징 형태도 품사 결합이다. "제목이 쓸모없다"는 근거로는 쓸 수 없다.
  - 전문가 간 일치도는 "moderate"로, 현저성 판단 자체가 주관적이다.
- **SWAT: A System for Detecting Salient Wikipedia Entities in Texts** — Ponza, Ferragina, Piccinno. Computational Intelligence, arXiv 1804.03580. [A1] [arXiv](https://arxiv.org/abs/1804.03580) / 도메인: 영어 NYT 108,925건, Wikinews 365건
  - NYT Micro F1: 첫 문장 46.7(P 59.1, R 38.6), TextRank 37.0, Rel-PageRank 30.6, CMU-Google 62.0, SWAT 64.1. Wikinews 첫 문장: P 23.3, R 67.0, F1 35.0.
  - 뉴스의 현저 정보는 앞부분에 몰린다고 명시. 위치를 무시한 그래프 방법은 단순 위치 baseline보다 나쁨.
  - **XGBoost 특징 중요도**: 중요 요소는 (i) 위치, (ii) **개체와 제목의 잠재 유사도**, (iii) 중심성, (iv) 주석 개체 간 일관성. 빈도는 **긴 문서(NYT)에서는 핵심이지만 짧은 문서(Wikinews)에서는 다른 신호와 결합할 때만 유용**. 수치 중요도는 그림에만 있어 숫자는 확인하지 못했다.
- **Leveraging Contextual Information for Effective Entity Salience Detection** — Bhowmik, Ponza, Tendle, Gupta, Jiang, Lu, Zhao, Preoţiuc-Pietro(Bloomberg). arXiv 2309.07990. [A2] [arXiv](https://arxiv.org/html/2309.07990v2) / 도메인: 영어 NYT-Salience 110,463건, WN-Salience 6,956건, SEL 365건, EntSUM 693건
  - F1: NYT 위치+빈도 60.3, 전체 특징 62.0, SWAT 64.1, cross-encoder(DeBERTa) **82.1**. WN 위치 특징 42.5 → 74.8. (baseline은 원논문 수치, cross-encoder는 새 시간순 분할이라 직접 비교 불가)
  - 위치 임베딩을 넣어도 결과가 혼재(RoBERTa NYT 81.1→81.4, DeBERTa SEL 68.5→64.7). 본문만으로 모델이 위치 신호를 이미 잡는 것으로 읽힌다.
  - **첫 언급이 제목이나 첫 문장이면 모든 모델이 잘 맞히며, 그런 개체는 현저할 확률이 높다고 서술**(수치는 그림에만 있음).
- **Scalable Detection of Salient Entities in News Articles** — Asgarieh, Thadani, O'Hare(Yahoo Research). arXiv 2405.20461, 2024. [A1] [arXiv](https://arxiv.org/abs/2405.20461) / 도메인: 영어 NYT, WN, SEL
  - 최고 pooling 모델이 강한 baseline 대비 F1 +11%(NYT), +41%(WN), +34%(SEL).
  - 2회만 언급된 개체도 AP 약 0.8 이상. 뒤쪽에 처음 등장해도 AP 약 0.8 이상. 학습된 모델은 위치·빈도 없이도 잡아낸다.
  - **Appendix B: LLM을 baseline으로 쓸 수 없다고 결론.** 현저성 정의가 데이터셋마다 달라 제로샷 프롬프트가 어렵고, few-shot은 예시 순서와 개수에 민감하며, LLM 출력을 후보에 다시 대응시킬 때 오류가 생긴다고 서술. **실험 수치가 아니라 논증이다.**
  - NYT로 학습해 WN에 적용하면 F1 0.712→0.520으로 하락(RoBERTa-Large). **현저성 정의가 도메인 간에 잘 안 옮겨진다.**

**빈도에 대한 반증**

- **WN-Salience: A Corpus of News Articles with Entity Salience Annotations** — Wu, Kanoulas, de Rijke, Lu. LREC 2020. [A1] [ACL](https://aclanthology.org/2020.lrec-1.257/) / 도메인: 영어 Wikinews 약 7,000건, 주석 약 9만 건
  - Naive Bayes F1(NYT / WN): 위치 baseline .4730 / .5044, head count .4078 / .2271, mentions .4182 / .2271, 1st-loc .2604 / .4250, + head count .4413 / .3988, + mentions .4732 / .3633.
  - **빈도 특징이 양쪽에서 정밀도를 낮춘다**고 저자들도 놀라움을 표시. WN에서는 F1도 .4250 → .3633으로 하락. 문서가 짧아 빈도 의미가 줄어든 것으로 설명.
  - **주의**: 단순 분류기 결과이고, 라벨은 Wikinews 카테고리 기반이다.
- **Towards Better Text Understanding and Retrieval through Kernel Entity Salience Modeling** — Xiong, Liu, Callan, Liu. SIGIR 2018, pp. 575-584, arXiv 1805.01334. [A2] [ar5iv](https://ar5iv.arxiv.org/html/1805.01334) / 도메인: 영어 NYT 65만 건, Semantic Scholar 100만 건
  - NYT P@1: 빈도 0.5840, 특징 기반 LeToR 0.6385, KESM 0.6866. R@1: 0.0781, 0.0886, 0.1010.
  - "빈도는 현저성과 같지 않다". 빈도 방식은 상위 0.1% 인기 개체를 실제보다 약 2배 많이 현저로 예측.

**위치에 대한 반증과 한계**

- SWAT의 위치 분석 — 같은 논문 [A1] [arXiv](https://arxiv.org/abs/1804.03580)
  - NYT 전체 108,925건 중 31,128건(약 29%)에 **처음 20% 이후에야 처음 등장하는 현저 개체**가 있음(44,192개). 반면 Wikinews에서는 이런 개체가 28개뿐.
  - 오류 분석(80건): 거짓 음성은 주로 위치 특징 때문. 거짓 양성의 상당수(NYT 약 35%, Wikinews 약 40%의 기사)는 정답 라벨 쪽 오류.
- **GUM-SAGE: A Novel Dataset and Approach for Graded Entity Salience Prediction** — Lin, Zeldes. arXiv 2504.10792, 2025(ACL Findings 2025로 검색 결과에 표기, 본문 미확인). [A2] [arXiv](https://arxiv.org/html/2504.10792v2) / 도메인: 영어 **12개 장르** 213문서, 뉴스 전용 아님
  - Spearman ρ: 위치 0.153, GPT-4o 제로샷 0.229, GPT-4o 3샷 0.254, 앙상블 0.540.
  - Top-1 F1: **GPT-4o 제로샷 0.444**(최고), 앙상블 0.367, 위치 0.054. Top-3 F1: 앙상블 0.527, GPT-4o 3샷 0.361.
  - GPT-4o는 저현저 개체에 중간 점수를 주는 경향(보정 불량). 빈도 baseline은 보고되지 않음.
- **What makes an entity salient in discourse?** — Zeldes, Lin. arXiv 2508.16464, 2025(2026 개정). [A2] [arXiv](https://arxiv.org/html/2508.16464) / 도메인: 영어 281문서, 24개 장르
  - 첫 언급 위치 r = -0.251, 문장 내 위치 r = -0.059, 언급 클러스터 크기 r² 약 0.45, 문서 내 분산도 |r| 약 0.73(랜덤 포레스트 최상위). **단일 일반화로는 부족하다**고 결론.
  - 분산도 수치는 요약 과정에서 음의 r²로 표기되는 등 원문 대조가 필요.
- **GUMsley: Evaluating Entity Salience in Summarization for 12 English Genres** — Lin, Zeldes. EACL 2024. [C] [arXiv](https://arxiv.org/pdf/2401.17974) / 스니펫 기준 제로샷 LLM과 요약 모델이 현저 개체를 잘 잡지 못함.

**기타 기초 문헌**

- **SEL: A Unified Algorithm for Salient Entity Linking** — Trani, Lucchese, Perego, Losada, Ceccarelli, Orlando. Computational Intelligence(2017~2018 표기 혼재), 이전 버전 DocEng 2016. [C] [PDF](https://iris.cnr.it/bitstream/20.500.14243/391717/1/prod_401740-doc_139648.pdf) / 도메인: 영어 Wikinews 365건, 사람 라벨. Bhowmik 표 기준 F1 52.0.
- **Identifying Salient Entities in Web Pages** — Gamon, Yano, Song, Apacible, Pantel. CIKM 2013, pp. 2375-2380, DOI 10.1145/2505515.2505602. [C] [Webis](https://ir.webis.de/anthology/2013.cikm_conference-2013.334/) / 도메인: 영어 **웹 페이지**. 검색 로그 기반 소프트 라벨, 문서·로그·웹 그래프 특징. 특징별 수치는 미확인.
- **EntSUM: A Data Set for Entity-Centric Extractive Summarization** — Maddela, Kulkarni, Preoţiuc-Pietro(Bloomberg). ACL 2022, pp. 3355-3366. [C] [arXiv](https://arxiv.org/abs/2204.02213v1) / 693문서, 현저 39%(Bhowmik 표).

### Inferences
- **OR 게이트(제목 또는 200자 내 또는 2회 이상)**: 첫 문장 baseline의 재현율이 약 38%이므로, 위치 하나만 쓰지 않고 다른 조건을 더한 방향은 문헌과 맞다. 반면 "2회 이상"은 짧은 뉴스에서 정밀도를 낮출 위험이 있다는 Wu·SWAT 보고와 긴장 관계다. 영향은 우리 기사 길이에 달려 있는데, 이 조사에서 측정하지 않았다.
- **200자 게이트**: "제목 또는 리드" 위주의 신호는 NYT와 Wikinews에서 강하다. NYT에서 늦게 등장하는 현저 개체가 약 29% 기사에 있는 점은 긴 기사나 분석 기사에서 놓칠 위험을 시사한다. Wikinews처럼 짧은 기사에서는 위험이 훨씬 작다.
- **가중치**: 문헌의 방식은 라벨 데이터로 학습한 분류기(로지스틱 회귀, GBDT 등)이고, 손으로 정한 합산을 근거 있게 만드는 숫자는 찾지 못했다. 또한 **요소 최댓값 합이 1.20**(.40+.20+.25+.25+.10)이라 상한 처리 여부에 따라 점수 해석이 달라진다.
- **빈도 .25와 제목 .40**: 빈도에 큰 가중을 주는 것은 짧은 기사 근거와 충돌할 수 있다. 제목에 가장 큰 가중을 주는 것은 SWAT의 제목 유사도, Bhowmik의 서술과 방향은 맞지만, 크기를 지지하는 근거는 없다.
- **"LLM says main" .25**: GUM-SAGE는 LLM이 **최상위 1개를 고르는 데는 강하지만 등급 보정은 약함**을 보여 준다. 연속 점수의 한 요소보다 "주요 대상 여부" 신호로 쓰는 쪽이 이 결과와 잘 맞는다. 단 12개 장르의 소규모 영어 데이터이고 Asgarieh의 회의론과도 함께 봐야 한다.
- **가장 중요한 해석 주의**: 이 문헌의 현저성은 "요약문에 나오는가"(NYT), "카테고리에 달렸는가"(WN)이다. "이 기사가 이 종목 투자자와 관련 있는가"와 같지 않다.

### Gaps
- **제목 등장 여부를 단독 특징으로 평가한 수치**를 찾지 못했다. Dunietz의 headline은 품사 결합 특징이고, SWAT은 제목 유사도이며 수치는 그림에만 있다.
- "처음 N자 이내" 같은 고정 길이 기준을 평가한 연구를 찾지 못했다. 대부분 문장 번호나 문서 내 비율이다.
- SWAT 특징 중요도의 정확한 숫자는 그림에만 있어 확인하지 못했다.
- Gamon 2013 원문(웹페이지 특징별 기여)은 접근에 실패했다.

---

## 5. 기사-기업 관련성(aboutness), 다종목 기사, 시황·목록 기사 판별

### Takeaway
"이 기사가 정말 이 회사에 관한 것인가"를 직접 다룬 학술 연구는 적고, **시황·목록 기사 판별이나 종목 수 임계값을 다룬 논문은 찾지 못했다.** 간접 근거로 Dolphin의 분포(기사의 94%가 티커 4개 이하)와 "목록 기사와 지나가는 언급이 오류 원천"이라는 관찰이 있다.

### Cited Findings
- **Extracting Structured Insights from Financial News** — Dolphin 외, 2024. [A2] [arXiv](https://arxiv.org/html/2407.15788) / 영어 5,530건
  - 기사의 59%가 티커 1개, **94%가 4개 이하**.
  - 제공사에는 있고 시스템에 없는 티커의 다수가 **바람직한 누락**으로 판단됨: 다른 회사 기사 속 지나가는 언급, 기사 하단 "Zacks Rank" 섹션.
  - 정당한 누락은 드물고 주로 **"today's big movers"류 다종목 목록 기사**에서 발생. 즉 목록 기사는 관련성 판단이 불안정한 구간이다.
- **Extracting Salient Named Entities from Financial News Articles** — 린셰핑 대학교 학위 논문, 2021, DiVA liu-181411. [C] [목록 페이지](https://openaccess.library.uitm.edu.my/Record/ndltd-UPSALLA1-oai-DiVA.org-liu-181411) / 도메인: 영어 금융 뉴스
  - 스니펫 기준: 중심 역할 기업 언급을 시퀀스 라벨링으로 추출. NLP 파서 + KB + 현저성 분류기의 2단계 방식과 격차가 미미. 저자와 수치 미확인. **주제상 가장 직접적이므로 원문 확인 가치가 크다.**
- **What company does my news article refer to?** — Fraunhofer 관련 2019. [C] [Publica](https://publica.fraunhofer.de/handle/publica/410967), [PDF](https://passwort.gwdg.de/hpc/_publications/wcdmnarttm19/publication.pdf) / 도메인: 영어, S&P 500
  - 스니펫 기준: 회사명 검색은 기술적으로 쉽지만 잘못된 결과가 많다고 지적. 회사 설명으로 학습해 회사명이 없는 기사도 분류. 저자와 수치 미확인.
- 상용 시스템 사례(논문 아님, 참고만): LSEG 포럼은 주요 기업은 관련도 약 80%, 지나가는 언급은 낮은 점수를 준다고 설명한다. [LSEG 포럼](https://community.developers.lseg.com/discussion/24494/whats-the-difference-between-relevance-confidence-and-score-from-trit-webinar-feb-8). 즉 산업계도 연결 여부와 관련도 점수를 분리한다. 계산 방식은 공개되지 않았다.

### Inferences
- 종목 수 초과 기사 제외는 Dolphin 분포와 모순되지 않는다. 다만 5와 9라는 임계값 자체의 근거는 없다. 미국 시장 분포이고 정답 기준도 사람 라벨이 아니다.
- "시황·목록 기사 제외"가 놓치는 것은 실제로 움직인 종목을 묶어 전달하는 기사다. Dolphin의 big movers 사례는 이런 기사가 이용자에게 가치 있을 수 있음을 시사한다. 제외가 옳은지는 서비스 목적의 문제이며, 문헌이 답하지 않는다.
- 연결(linking) 판단과 관련도(relevance) 점수를 분리한 우리 구조는 산업계 관행과 같은 방향이다. 다만 관행은 공개 문서 수준의 근거다.

### Gaps
- **시황·라운드업·목록 기사 탐지 논문을 찾지 못했다.** 영어·한국어로 검색했으나 관련 학술 결과가 없었다. 존재하지 않는다는 뜻이 아니라 이번 검색에서 나오지 않았다는 뜻이다.
- FinNLP 워크숍 프로시딩을 체계적으로 훑지 못했다.
- 다종목 기사에서 주 종목을 고르는 공개 데이터셋을 찾지 못했다. Dolphin 데이터는 공개돼 있으나 주 종목 라벨이 아니다.

---

## 6. 제목·리드·빈도 접근과 충돌하는 근거

### Takeaway
규칙 자체를 틀렸다고 보는 근거보다, **학습 모델이 훨씬 낫다, 빈도는 약한 신호다, 위치는 긴 기사에서 놓친다, 수치가 다른 장르로 잘 안 옮겨진다**는 네 가지 반론이 있다. 첫째 반론이 가장 크지만 라벨 데이터가 전제다.

### Cited Findings
- **학습 모델의 격차**: NYT에서 위치+빈도 60.3, cross-encoder 82.1(분할이 달라 직접 비교 불가) — [Bhowmik](https://arxiv.org/html/2309.07990v2). Yahoo 모델은 강한 baseline 대비 F1 +11~41% — [Asgarieh](https://arxiv.org/abs/2405.20461).
- **빈도**: 빈도 특징이 정밀도를 낮추고 WN에서 F1을 .4250→.3633으로 떨어뜨림 — [Wu](https://aclanthology.org/2020.lrec-1.257/). 짧은 문서에서 단독으로는 유용성이 낮음 — [SWAT](https://arxiv.org/abs/1804.03580). 인기 개체 과대 예측 — [KESM](https://ar5iv.arxiv.org/html/1805.01334).
  - **반대 방향**: 언급 클러스터 크기와 분산도는 강한 상관 — [Zeldes & Lin](https://arxiv.org/html/2508.16464). Dunietz에서는 mentions 단독 F1 54.1로 첫 문장 46.2보다 높음 — [Dunietz](https://aclanthology.org/E14-4040/). Dunietz의 mentions는 **상호참조를 포함한 수**이고 head-count 단독은 44.4다. **문자열 횟수만 세는 우리 방식은 낮은 쪽에 더 가깝다.**
- **위치**: NYT 약 29%의 기사에 뒤늦게 등장하는 현저 개체 — [SWAT](https://arxiv.org/abs/1804.03580). 다장르에서 위치 Spearman 0.153 — [GUM-SAGE](https://arxiv.org/html/2504.10792v2). Wikinews의 첫 문장 baseline 정밀도 23.3%로, 앞에 나온다고 주인공이 아님 — [SWAT](https://arxiv.org/abs/1804.03580).
- **도메인 이전**: NYT 학습 모델을 WN에 적용하면 크게 하락 — [Asgarieh](https://arxiv.org/abs/2405.20461). 이는 **영어 위 수치를 한국어 주식 뉴스에 옮기는 것 자체에 대한 경고**이기도 하다.
- **평가 데이터의 신뢰성**: 라벨 오류가 ChatEL·SWAT 양쪽에서 보고됨 — [ChatEL](https://aclanthology.org/2024.lrec-main.275.pdf), [SWAT](https://arxiv.org/abs/1804.03580). 28건 라벨에서도 같은 문제가 있을 수 있다.

### Inferences
- **지지되는 부분**: 위치와 언급 수 기반의 규칙은 비용 대비 합리적인 출발점이다. LLM을 추출에 쓰고 코드로 검증하는 구조도 Dolphin과 방향이 같다.
- **근거가 약한 부분**: 손으로 정한 가중치 크기, 200자 기준, 5·9개 임계값, 문자열 빈도의 큰 비중, 28건에 기반한 "후보 방식이 더 나쁘다"의 일반화.
- **근거가 없는 부분**: 한국어 주식 뉴스에서의 모든 수치.
- 라벨 데이터가 없으면 학습 모델이라는 반론은 현실적 대안이 아니다. 따라서 이 반론은 "규칙이 틀렸다"가 아니라 "규칙 성능에는 알려진 상한이 있다"로 읽는 것이 맞다.

### Gaps
- 규칙 기반과 학습 기반을 **한국어 또는 금융 뉴스**에서 비교한 연구를 찾지 못했다.
- 위 수치 대부분은 "요약에 등장" 등 대체 라벨 기준이며, 투자자 관점의 관련성 라벨로 잰 수치를 찾지 못했다.
