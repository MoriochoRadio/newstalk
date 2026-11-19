# 뉴스 사건 묶기·근사 중복 탐지·임계값 근거 논문 조사

조사일 2026-11-05. 대상 로직: 같은 종목 + 제목 2글자 bigram Jaccard ≥ 0.10 + 24시간 이내면 한 그룹. 임계값은 약 21개 그룹을 읽어 오병합이 없어 정했고 정답 라벨은 없음. 내부 시험에서 제목 유사도가 다른 기사 0.85, 같은 사건 0.41로 역전된 사례가 있음.

**확인 수준 표기** (원문을 어디까지 열었는지 구분. 기억으로 인용한 항목 없음)
- [본문]: 논문 본문을 열어 수치를 직접 확인
- [초록]: 초록 또는 서지 페이지를 열어 확인, 본문 미확인
- [검색]: 검색 결과에 표시된 서지·발췌로만 확인. 페이지 직접 열기는 실패 또는 미시도. 인용 전 재확인 권장

## 1. 뉴스 사건 탐지와 스토리 클러스터링: 벤치마크와 점수

### Takeaway
표준 벤치마크(영어 Miranda 코퍼스)에서 B-Cubed F1은 약 90~95이며, 상위 시스템은 모두 제목·본문·개체·시간을 함께 쓴다. 고정 임계값보다 학습된 판단이 크게 앞선 결과가 있어, 고정 임계값 방식은 단순하지만 성능 한계가 있는 방식으로 설명해야 한다.

### Cited Findings
- **Multilingual Clustering of Streaming News** — Miranda, Znotiņš, Cohen, Barzdins, 2018, EMNLP [본문]. 영어 테스트 8,726건·222개 클러스터, 독일어 2,101건·118개, 스페인어 2,177건·149개. 영어 F1 94.1(P 98.2, R 90.3). 적용: 사건 묶기의 표준 데이터셋과 기준선. — [ACL Anthology](https://aclanthology.org/D18-1483/), [arXiv](https://arxiv.org/abs/1809.00540)
- 같은 논문의 임계값 비교(영어): 격자 탐색한 τ는 F1 82.8(P 96.5, R 72.4), SVM 판단은 F1 94.1. 다국어 연결에서 전역 τ는 F1 72.7이었고, 저자들은 모든 언어 쌍에 맞는 τ를 찾지 못했다고 보고했다. τ는 개발 세트로 언어별 조정했다. 적용: 라벨로 튜닝한 τ도 정밀도는 높고 재현율이 낮았다는 직접 근거. — [arXiv](https://arxiv.org/abs/1809.00540)
- **Event-Driven News Stream Clustering using Entity-Aware Contextual Embeddings** — Saravanakumar, Ballesteros, Chandrasekaran, McKeown, 2021, EACL [본문]. 영어 B-Cubed F1 비교(실제 클러스터 222개): Laban & Hearst 89.76(873개), Miranda 92.36(326개), Staykovski 94.41(484개), Linger & Hajaiej 93.86(298개), 제안 모델 94.76(276개). 고정 임계값 대신 신경망 분류기로 클러스터 생성을 판단한다. — [ACL Anthology](https://aclanthology.org/2021.eacl-main.198), [arXiv PDF](https://arxiv.org/pdf/2101.11059)
- **newsLens: building and visualizing long-ranging news stories** — Laban, Hearst, 2017, Events and Stories in the News Workshop(ACL) [검색]. 20개 매체 400만 기사에서 8만 개 스토리 추출. 지역 시간대 토픽을 먼저 묶고 이후 장기 스토리로 연결. 적용: 지역 묶음 후 연결하는 2단계 구조의 선례. — [ACL Anthology](https://aclanthology.org/W17-2701/)
- **Dense vs. Sparse Representations for News Stream Clustering** — Staykovski, Barrón-Cedeño, Da San Martino, Nakov, 2019, Text2Story@ECIR [검색]. newsLens를 기준선으로 sparse·doc2vec·결합을 비교. PDF 직접 접근은 403으로 실패. 수치 94.41은 Saravanakumar 표에서 재인용한 것이다. — [UniBo CRIS](https://cris.unibo.it/handle/11585/709220), [DBLP](https://dblp.org/rec/conf/ecir/StaykovskiBMN19.html)
- **Topic Detection and Tracking Pilot Study Final Report** — Allan, Carbonell, Doddington, Yamron, Yang, 1998, DARPA Broadcast News Workshop [본문 일부]. 코퍼스 약 16,000건, 사건 25개. CMU는 비교 대상을 고정 기간으로 제한했고, UMass는 시간이 지날수록 매칭 임계값을 높이는 aging factor가 중요하다고 보고했다. 적용: 시간 조건과 임계값 조정의 최초 근거. — [CMU PDF](https://www.cs.cmu.edu/~jgc/publication/Topic_Detection_Tracking_Pilot_DARPA_1998.pdf)
- **On-Line New Event Detection and Tracking** — Allan, Papka, Lavrenko, 1998, SIGIR, DOI 10.1145/290941.290954 [검색]. 단일 패스 클러스터링을 수정한 first story detection. — [서지 페이지](https://www.cs.utexas.edu/~shivaram/readings/b2hd-AllanPL1998.html)
- **A Study on Retrospective and On-Line Event Detection** — Yang 외, 1998, SIGIR [초록]. 15,836건, 내용+시간 정보 사용. F1은 사후 탐지 82%, 온라인 탐지 42%. 페이지의 저자 순서는 Yang, Carbonell, Pierce이고 다른 서지 결과는 Yang, Pierce, Carbonell이라 인용 시 확인 필요. — [SIGIR'98 초록](https://people.eng.unimelb.edu.au/ammoffat/sigir98/abstracts/yang.html)

### Inferences
- 우리 로직은 "온라인 단일 패스 + 고정 임계값 + 시간 조건" 계열의 가장 단순한 형태로 분류할 수 있다. 다만 위 논문의 임계값은 라벨 개발 세트로 조정했고, 우리 0.10은 그렇지 않아 같은 수준의 근거로 내세울 수 없다.
- 벤치마크 점수는 영어·장문 본문·긴 기간의 사건 기준이다. 한국어 제목·종목 단위 묶기의 기대 성능으로 옮겨 쓰면 안 된다.

### Gaps
- Miranda 영어 수치가 자체 논문 94.1(P 98.2, R 90.3)과 Saravanakumar 표 92.36(P 94.27, R 90.25)으로 다르다. 후자는 B-Cubed다. 전자의 지표 정의는 이번에 확정하지 못했다.
- Saravanakumar 표는 PDF 추출 시 행 이름과 수치가 한 줄 밀려 나왔다. 본문 언급값(91.7, 89.6, 92.04, Miranda 92.36)과 대조해 행을 맞췄다.

## 2. 제목 vs 본문 vs 임베딩, 개체·시간 조건의 효과

### Takeaway
시간 정보의 효과는 일관되게 크고, 개체 정보도 도움이 되지만 단독으로는 부족하다. 제목은 정밀도는 높고 재현율이 낮다는 근거가 있어, 우리 내부의 0.85/0.41 역전과 방향이 같다. 다만 제목 단독과 본문을 정면 비교한 근거는 소규모 1건뿐이다.

### Cited Findings
- 시간 효과(Miranda) [본문]: timestamp 추가 시 F1이 영어 92.7→94.1, 독일어 90.7→97.1, 스페인어 88.8→94.2. timestamp 단독 영어는 F1 61.1(P 44.5, R 97.6). Gaussian σ는 72시간으로 개발 세트 조정. 저자들은 timestamp 특징이 τ 최적화를 방해했다고도 보고했다. — [arXiv](https://arxiv.org/abs/1809.00540)
- 시간·개체 효과(Saravanakumar) [본문]: TF-IDF 86.36→TF-IDF+Time 91.72, TF-IDF+E-S-BERT 88.18→+Time 94.76, S-BERT 92.04→개체 인식 E-S-BERT 94.76. 임베딩 단독 E-S-BERT는 68.98. 사전학습 BERT 단독은 토픽이 비슷한 다른 사건을 묶는 경향이 있었다(예: 서로 다른 축구 사건). — [arXiv PDF](https://arxiv.org/pdf/2101.11059)
- **RevDet: Robust and Memory Efficient Event Detection and Tracking in Large News Feeds** — Azeemi 외, 2021, arXiv 프리프린트 [본문]. 중복 기사 수작업 라벨 354건·7개 사건에서 쌍 단위 평가. 제목+위치 1단계 후 counts 2단계가 P 0.97, R 0.77, F1 0.86. 내용(themes) 사용 시 P 0.96, R 0.81, F1 0.88. 제목 평균 길이 18.7자, themes 16,476자. 저자들은 낮은 재현율이 제목 표현 차이 때문이라고 본다. 사건 체인 창은 8일이 적절하고 그 이상은 F1 0.64~0.66으로 변화가 적었다. 표기 불일치: 표에는 정밀도 0.81, 본문에는 0.82. 소규모이고 동료심사 미확인. — [arXiv](https://arxiv.org/abs/2103.04390), [PDF](https://arxiv.org/pdf/2103.04390)
- **Real-time News Story Identification** — Škvorc, Ivačič, Hribar, Robnik-Šikonja, 2025, arXiv [본문]. 슬로베니아어 6,400건·4,028 스토리. AMI: BGE-M3 전문 0.8378, TF-IDF 0.603, 개체명만 0.678, 전문+개체명 0.791, 요약 입력 0.780. 개체명은 군집 성능은 낮추지만 이상치 탐지는 높였다(0.762~0.768 vs 0.720). 스토리당 최대 10일, 오래된 기사는 감쇠. 병합 임계값은 언어·주제별 조정이 필요하다고 명시. 평가 기간 표기가 10일과 1개월로 섞여 있음. — [arXiv](https://arxiv.org/abs/2508.08272), [HTML](https://arxiv.org/html/2508.08272)
- **Russian News Clustering and Headline Selection Shared Task** — Gusev, Smurov, 2021, Dialogue [본문]. 같은 클러스터 조건은 사건 시점·수치(주가, 피해자 수 등)·장소가 같은 것이고, 수치나 시점이 다르거나 사건 기사와 논평의 조합은 다른 클러스터다. 라벨링은 "두 제목을 바꿔 써도 되는가" 기준. 일별 약 8,500~14,800쌍, 5명 중 4명 이상 합의만 채택, 양성 46~49%. 비공개 리더보드 최고 F1 96.0, 언어모델 임베딩 없는 최고 93.0. 저자들은 수치·개체·시점만 다른 문서 쌍을 만들어 점검하는 방법을 제안한다. — [arXiv](https://arxiv.org/abs/2105.00981), [PDF](https://arxiv.org/pdf/2105.00981.pdf)
- **SemEval-2022 Task 8: Multilingual news article similarity** — Chen 외, 2022, SemEval [초록]. 약 10,000쌍, 18개 언어 조합, 7개 유사도 차원. 최고 상관 0.818. 적용: 기사 유사성이 사건 외에 여러 차원으로 나뉜다는 근거. — [ACL Anthology](https://aclanthology.org/2022.semeval-1.155/)
- 시간 벌점의 한국어 근거는 3번 항목의 정영미·김용광(2008) 참조.

### Inferences
- 내부 시험의 "제목 유사도만으로는 분리 불가"는 예외가 아니라 선행 연구와 맞는 결과로 설명할 수 있다. 다른 기사 0.85는 Gusev가 짚은 "수치·시점만 다른 쌍"에, 같은 사건 0.41은 RevDet이 짚은 표현 차이로 인한 낮은 재현율에 대응한다.
- 종목 일치는 개체 조건과 유사하지만 논문들의 개체는 본문 NER이고, 우리는 종목 하나로 강하게 거르는 조건이다. 종목 필터의 효과를 위 수치로 추정할 수는 없다.
- 24시간은 조사한 창(가우시안 σ 72시간, 8일, 10일)보다 훨씬 짧다. 다만 그 논문들은 며칠에 걸친 스토리를 대상으로 하므로 직접 비교는 안 된다. "일일 요약 단위라 하루 안 사건만 묶는다"는 설계 이유로 설명해야 하고, 날을 넘는 후속 기사가 끊긴다는 한계를 함께 적는 편이 정확하다.

### Gaps
- 한국어 제목만으로 사건을 묶는 성능을 본문과 정면 비교한 논문은 찾지 못했다.
- 같은 종목 + 시간 창 조건의 효과를 분리 측정한 논문도 찾지 못했다.

## 3. 근사 중복 탐지와 한국어 문자 n-gram

### Takeaway
Jaccard·shingling은 근사 중복의 표준 정의이지만, 고전 연구의 기준값(예: 50%)은 긴 문서의 거의 같은 내용을 찾는 용도다. 우리 0.10은 후보를 넓게 잡는 값으로, 이 문헌에서 값 자체의 근거를 얻을 수 없다. 한국어에서 문자 bigram이 쓸 만하다는 근거는 검색(IR) 분야에 있다.

### Cited Findings
- **On the resemblance and containment of documents** — Broder, 1997, Compression and Complexity of Sequences [본문]. 3,000만 건 이상(150GB)을 50% resemblance 기준으로 묶어 360만 클러스터·1,230만 문서를 찾음. 같은 문서 쌍도 shingle 크기 1·2·3에 따라 resemblance가 70%·50%·30%로 달라지는 예시 제시. 적용: Jaccard 수치는 토큰 정의에 묶여 있어 다른 연구의 값을 그대로 가져올 수 없다는 근거. — [PDF](https://www.cs.princeton.edu/courses/archive/spring13/cos598C/broder97resemblance.pdf)
- **Similarity estimation techniques from rounding algorithms** — Charikar, 2002, STOC, DOI 10.1145/509907.509965 [검색]. 반올림 알고리즘을 LSH로 해석한 SimHash 계열의 출발점. — [PDF](https://www.cs.princeton.edu/courses/archive/spr05/cos598E/bib/p380-charikar.pdf)
- **Detecting Near-Duplicates for Web Crawling** — Manku, Jain, Das Sarma, 2007, WWW, DOI 10.1145/1242572.1242592 [검색]. 약 80억 웹페이지에서 64비트 지문 + 해밍거리 k=3이 적절. PDF 호스트가 DNS 오류로 열리지 않아 정밀도·재현율 수치는 미확인. — [DBLP](https://dblp1.uni-trier.de/rec/conf/www/MankuJS07.html)
- **Finding near-duplicate web pages: a large-scale evaluation of algorithms** — Henzinger, 2006, SIGIR [초록]. 16억 페이지. 정밀도 Charikar 0.50, Broder 0.38, 결합 0.79(재현율은 다른 알고리즘의 79%). 같은 사이트 내 쌍에서는 둘 다 약하고 다른 사이트 간에는 정밀도가 높음. 적용: 대규모 기법도 정밀도가 0.4~0.5에 그칠 수 있어 수작업 평가가 필요하다는 근거. — [EPFL](https://infoscience.epfl.ch/record/99373?ln=en)
- **Using n-Grams for Korean Text Retrieval** — Joon Ho Lee, Jeong Soo Ahn, 1996, SIGIR, DOI 10.1145/243199.243269 [검색]. 서지만 확인, 결과 수치 미확인. — [DBLP](https://dblp1.uni-trier.de/rec/conf/sigir/LeeA96.html)
- **Statistical and Comparative Evaluation of Various Indexing and Search Models** — Abdou, Savoy, 2006, LNCS 4182 [초록]. NTCIR-5 신문 컬렉션에서 "the bigram-based indexing strategy seems to be the best choice for Korean". 수치는 페이지에 없음. — [UniNE](https://libra.unine.ch/handle/123456789/14406)
- **n-Gram-based indexing for Korean text retrieval** — 1999, Information Processing & Management [검색]. 어절 색인은 복합명사 때문에 성능이 떨어지고, 제안 n-gram이 형태소 색인보다 빠르고 효과도 좋다는 요약 발췌. 페이지가 열리지 않아 저자 전체와 수치 미확인. 같은 검색의 KIPS 1999 연구는 OCR 문서에서 2-gram이 형태소 색인과 비슷하다고 보고. — [목록 페이지](https://acnpsearch.tweb-dev.unibo.it/singlejournalindex/65299525), [KIPS](https://koreascience.or.kr/article/JAKO199911919550046.page)
- **사건중심 뉴스기사 자동요약을 위한 사건탐지 기법에 관한 연구** — 정영미, 김용광, 2008, 정보관리학회지 25(4) [초록]. SVM 범주 분류 후 수정 싱글패스, 고유명사 가중치, 시간 벌점 함수 사용. 단순 싱글패스 대비 향상률: 정확률 37.1%, 재현율 0.1%, F 35.4%, 오보율 74.7%, 탐지비용 11.3%. 원점수와 상대·절대 구분은 페이지에 없음. 적용: 한국어 뉴스에서 고유명사 + 시간 조건을 쓴 가장 가까운 선례. — [AccessON](https://www.accesson.kr/kosim/v.25/4/227/394)
- **Hierarchical and Incremental Clustering for Semi Real-time Issue Analysis on News Articles** — Hoyong Kim, SeungWoo Lee, Hong-Jun Jang, DongMin Seo, 2020, DOI 10.5392/JKCA.2020.20.06.556 [본문 일부]. 샴 신경망 가중 코사인 + 점증적 이슈 트리. NMI 최대 약 0.26 향상, 약 10배 빠름. 유사도·병합·노이즈·크기 임계값을 각각 둠. 한글 폰트 추출이 깨져 한글 제목과 임계값 수치는 미확인. — [PDF](https://koreascience.kr/article/JAKO202018955008139.pdf)
- **뉴스 중복 제거에 따른 정보 유실 방지하기 위한 중복 뉴스 결합 시스템** — 김태환, 최원재, 김정선, 2020, 한국컴퓨터정보학회 하계학술대회 28(2), pp. 391–392 [초록]. 중복 기사를 지우면 일부 정보가 사라지므로 문장 관계 유사도로 빠진 내용을 찾아 기본 기사에 합친다. 수치 없음, 2쪽 논문. — [ERICA](https://erica.scholarworks.kr/handle/2021.sw.erica/991)
- **잡음 정제를 통한 고응집도 군집과 후반부 요약을 이용한 효과적인 뉴스 요약** — 디지털콘텐츠학회논문지 25권 [검색]. HDBSCAN 후 Mean-Shift와 잡음 정제. 저자·수치 미확인. — [Kumoh 저장소](https://scholarworks.bwise.kr/kumoh/bitstream/2020.sw.kumoh/28885/1/%ec%9e%a1%ec%9d%8c%20%ec%a0%95%ec%a0%9c%eb%a5%bc%20%ed%86%b5%ed%95%9c%20%ea%b3%a0%ec%9d%91%ec%a7%91%eb%8f%84%20%ea%b5%b0%ec%a7%91%ea%b3%bc%20%ed%9b%84%eb%b0%98%eb%b6%80%20%ec%9a%94%ec%95%bd%ec%9d%84%20%ec%9d%b4%ec%9a%a9%ed%95%9c%20%ed%9a%a8%ea%b3%bc%ec%a0%81%ec%9d%b8%20%eb%89%b4%ec%8a%a4%20%ec%9a%94%ec%95%bd.pdf)

### Inferences
- "한국어에 문자 bigram을 쓴다"는 선택은 IR 근거로 뒷받침할 수 있다. 단, 이 연구들은 검색 성능을 측정한 것이고 제목 간 Jaccard를 측정한 것이 아니므로 "유사 과제의 간접 근거"로 표현해야 한다.
- "0.10"은 Broder의 50%와 토큰 단위·문서 길이가 달라 낮다거나 높다고 직접 비교할 수 없다. 짧은 제목에서는 우연히 겹치는 bigram의 영향이 상대적으로 커질 수 있다는 점은 추론이며 측정이 필요하다.

### Gaps
- 한국어 뉴스 제목에 음절 bigram Jaccard를 적용해 임계값을 평가한 학술 논문은 찾지 못했다. 검색에 나온 것은 프로그래머스 "뉴스 클러스터링" 풀이 글뿐이고 학술 근거로 쓸 수 없다.
- KCI·RISS·DBpia에 직접 질의하지 못했고 일반 검색과 KoreaScience·AccessON·기관 저장소로만 찾았다. 국내 문헌 누락 가능성이 있고 KCI 등재 여부도 확인하지 않았다.

## 4. 라벨 없는 임계값 선택과 평가 지표·표본 크기

### Takeaway
라벨 없이 값을 정당화할 만한 표준 방법은 찾지 못했다. 현재 근거(21개 그룹 오병합 0건)는 오병합률 상한을 약 13%로만 제한하고, 재현율은 전혀 말해주지 못한다. 문헌의 일반적인 경로는 후보 쌍·클러스터를 표본 추출해 라벨을 붙이고 설계 가중치로 추정하는 것이다.

### Cited Findings
- **If Nothing Goes Wrong, Is Everything All Right? Interpreting Zero Numerators** — Hanley, Lippman-Hand, 1983, JAMA 249(13) [검색]. 사건 0건일 때 95% 상한을 3/n으로 근사(이른바 rule of three). 재인용 글은 n>30을 조건으로 든다. — [Scilit](https://scilit.net/publications/ddfc523d905fccaecb8488227831d6ec), [BMJ 해설](https://adc.bmj.com/content/archdischild/90/6/642.2.full.pdf)
- **A comparison of extrinsic clustering evaluation metrics based on formal constraints** — Amigó, Gonzalo, Artiles, Verdejo, 2009, Information Retrieval 12(4), DOI 10.1007/s10791-008-9066-8 [검색]. 여러 지표 중 BCubed만 형식 제약을 모두 만족. Figure 17·18 정오표 있음. — [BibSonomy](https://www.bibsonomy.org/bibtex/2bf5389827876132d05a0e73c662fbca4/jullybobble?lang=ru), [Springer 정오표](https://link.springer.com/content/pdf/10.1007/s10791-009-9106-z.pdf)
- B-Cubed의 한계(Saravanakumar) [본문]: 큰 클러스터에 가중을 두어 작은 사건의 분할 오류를 잘 잡지 못한다. 그래서 CEAF-e를 추가 보고(제안 모델 76.93, Miranda 69.57). 표에서도 Laban & Hearst는 실제 222개에 873개를 만들고도 B-Cubed F1 89.76을 받았다. Amigó의 결론과 긴장 관계이므로 지표 하나만 쓰지 않는 근거가 된다. — [arXiv PDF](https://arxiv.org/pdf/2101.11059)
- **Estimating the Performance of Entity Resolution Algorithms: Lessons Learned Through PatentsView.org** — Binette 외, 2022, The American Statistician [본문]. 표본 클러스터에서 단순 계산한 쌍 단위 정밀도는 낙관 편향이 있다. 시뮬레이션(표본 100/200/400)에서 단순 추정 편향은 오귀속률 5%·10%·20%일 때 0.099, 0.195, 0.366이고 표본을 늘려도 줄지 않았다. 제안 추정량은 편향 약 0.004 이내, RMSE 0.021~0.063. 실제 평가는 발명가 100명을 크기 비례 추출. — [arXiv](https://arxiv.org/abs/2210.01230)
- **In Search of an Entity Resolution OASIS** — Marchant, Rubinstein, 2017 [검색]. 일치 쌍이 드물 때 중요도 표집으로 F값·정밀도·재현율 추정, 라벨링을 최대 83% 절감 보고. — [arXiv PDF](https://arxiv.org/pdf/1703.00617)
- Gusev·Smurov의 평가 설계 [본문]: 전체 정답 없이 기준 시스템 출력 쌍을 표본 추출하고 소수 무작위 쌍을 섞어 라벨링한 뒤 쌍 단위 F1로 평가. 뉴스 도메인 선례다. — [arXiv PDF](https://arxiv.org/pdf/2105.00981.pdf)
- **A Sober Look at Clustering Stability** — Ben-David, von Luxburg, Pál, 2006, COLT [초록]. 표본이 크면 안정성은 목적함수의 최적해 유일성으로 결정되어, 군집 수 선택 도구로 부적합할 수 있다. 적용: "값을 흔들어도 결과가 안정적"만으로는 근거가 약하다. — [MLAnthology](https://mlanthology.org/colt/2006/bendavid2006colt-sober)
- **Silhouettes: A graphical aid to the interpretation and validation of cluster analysis** — Rousseeuw, 1987, J. Comput. Appl. Math. [검색]. 평균 실루엣으로 군집 수를 고르는 무라벨 지표. 흔히 쓰는 0.25/0.5/0.7 구간은 원논문에서 확인하지 못했다. — [BibBase](https://bibbase.org/network/publication/rousseeuw-silhouettesagraphicalaidtotheinterpretationandvalidationofclusteranalysis)
- **Event detection in finance using hierarchical clustering algorithms on news and tweets** — Carta 외, 2021, PeerJ Computer Science 7, e438 [본문]. Dow Jones S&P 500 뉴스 8,403건, 평균연결 응집 군집. 매일 k=2~10 중 실루엣 최대를 선택(사례별 0.28, 0.27, 0.36). 이상치 제거로 실루엣·Dunn이 약 50% 향상. 응집 군집에 무라벨 선택을 쓴 금융 사례지만 시장 단위이고 종목 단위가 아니다. — [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC8157256)

### Inferences
- 21개 그룹 오병합 0건을 독립 무작위 표본으로 가정하면 정확한 95% 상한은 1−0.05^(1/21) ≈ 13.3%, 근사 3/21 ≈ 14.3%다(본 노트의 계산). n이 30 미만이라 근사보다 정확 계산을 쓰는 편이 낫다. 또한 무작위 추출이 아니었거나 그룹이 작았다면 이 상한도 성립하지 않는다.
- 묶인 그룹을 읽는 방식은 정밀도 쪽만 본다. 임계값이 낮을수록 오병합 위험이 커지는 방향이므로 재현율을 재지 않아도 0.10의 위험은 정밀도로 일부 볼 수 있지만, 내부 시험의 0.41·0.85 역전을 보면 그룹 밖에 남은 쌍과 시간·종목 조건에 걸러진 쌍도 표본에 포함해야 평가가 완결된다.
- 정당화 문구로는 "라벨 튜닝값"이 아니라 "소규모 수작업 점검으로 정한 잠정값, 오병합률 95% 상한 약 13%(가정 충족 시), 재현율 미측정"이 정확한 표현이다.

### Gaps
- 뉴스 클러스터링 임계값 선택에 필요한 표본 크기 공식을 직접 제시한 논문은 찾지 못했다. 위 표본 수치는 시뮬레이션 값이며 뉴스 데이터에 그대로 적용되지 않는다.
- OASIS의 게재처는 이번에 확인하지 못했다.

## 5. 다문서 요약의 환각·의미 변형(일일 요약 단계)

### Takeaway
여러 기사를 합친 요약에서 오류가 많다는 근거는 탄탄하지만, 75% 같은 큰 수치는 폭넓은 정의에 따른 것이다. 기사 병합 때문에 출처가 뒤섞이는 문제를 직접 측정한 논문은 찾지 못했다.

### Cited Findings
- **From Single to Multi: How LLMs Hallucinate in Multi-Document Summarization** — Belem, Pezeshkpour, Iso, Maekawa, Bhutani, Hruschka, 2024/2025, NAACL Findings [초록+본문 일부]. LLM 5종에서 요약 내용의 평균 최대 75%가 환각, 뒤쪽일수록 많음. 없는 주제를 요청하면 gpt-3.5-turbo 79.35%, GPT-4o 44%가 그래도 요약을 생성. 수작업 700개 이상 검토 결과 대부분 지시 불이행 또는 지나치게 일반적인 내용. 후처리 기법은 효과가 보통 수준. — [arXiv](https://arxiv.org/abs/2410.13961)
- 같은 논문의 뉴스 오류 유형(subtopic, N=2): 맥락 불일치 10.64~36.37%, 완전한 조작 0~8.51%(오류 대비 비율, 중복 집계). 맥락 불일치 예시는 개인 의견의 일반화, 은행·정부기관이 함께 나온 문서를 은행 하나로 좁힌 경우다. 문서 간 개체를 섞는 사례는 제시되지 않았다. — [arXiv HTML](https://arxiv.org/html/2410.13961)
- **Embrace Divergence for Richer Insights: A Multi-document Summarization Benchmark and a Case Study on Summarizing Diverse Information from News Articles** — Huang, Laban, Fabbri, Choubey, Joty, Xiong, Wu, 2023/2024, NAACL [초록]. 245개 스토리, 스토리당 기사 10개. GPT-4가 다양한 정보를 평균 40% 미만만 포함. 충실성보다 포괄성이 문제라는 검색 발췌도 있음. — [arXiv](https://arxiv.org/abs/2309.09369)
- **Understanding Factuality in Abstractive Summarization with FRANK** — Pagnoni, Balachandran, Tsvetkov, 2021, NAACL [검색]. 단일 문서 요약. 주석 요약의 60%에 사실 오류, XSum 92%, CNN/DM 43%. 개체 오류가 두 데이터셋 모두에서 상위 유형. — [ACL Anthology](https://aclanthology.org/2021.naacl-main.383)
- **SummaC: Re-Visiting NLI-based Models for Inconsistency Detection in Summarization** — Laban 외, 2022, TACL [검색]. 문서를 문장으로 나눠 점수를 집계, 최고 모델 균형 정확도 74.4%. 단일 문서 대상이라 어느 기사에서 나온 주장인지는 구분하지 못한다. — [ACL Anthology](https://aclanthology.org/2022.tacl-1.10)

### Inferences
- 사건이 다른 기사가 한 그룹에 섞이면 요약 입력 자체가 오염되므로, 묶기 임계값의 오병합은 요약 단계 오류로 이어질 수 있다. 다만 이 경로의 크기를 측정한 논문은 찾지 못했으므로 위험 가설로 적어야 한다.
- 결과를 인용할 때 "75%가 지어낸 내용"이라고 쓰면 과장이다. 같은 논문의 조작 비율은 오류 중 0~8.51%이고 대부분은 지시 불이행이나 일반론이다.

### Gaps
- 다문서 병합이 귀속(누가 말했나)을 왜곡하는 비율을 직접 측정한 논문은 찾지 못했다.
- 종목별 일일 뉴스 요약의 환각을 측정한 논문, 한국어 다문서 요약 환각 논문도 찾지 못했다.

## 6. 금융 뉴스 중복과 재탕 뉴스의 가치

### Takeaway
금융 문헌은 "같은 기업 + 텍스트 유사도"로 재탕 뉴스를 측정해 왔고, 재탕 뉴스에 대한 시장 과잉 반응과 반전을 보고한다. 특히 재인쇄보다 여러 출처를 재조합한 기사에 반응이 더 크므로, 기사 수를 새로운 정보량으로 해석하면 위험하다.

### Cited Findings
- **All the News That's Fit to Reprint: Do Investors React to Stale Information?** — Tetlock, 2011, Review of Financial Studies 24(5), 1481–1512 [초록]. staleness를 같은 기업의 직전 기사 10건과의 텍스트 유사도로 정의. 수익률은 재탕 뉴스에 덜 반응하지만 당일 수익률이 다음 주 반전을 예측하고, 개인 투자자가 재탕 뉴스에 더 적극적으로 거래. 초록 페이지에 효과 크기 수치는 없음. — [IDEAS](https://ideas.repec.org/a/oup/rfinst/v24y2011i5p1481-1512.html)
- **When can the market identify old news?** — Fedyk, Hodson, 2023, Journal of Financial Economics 149(1), 92–113, DOI 10.1016/j.jfineco.2023.04.008 [초록]. Bloomberg 기사 1,700만 건. 재조합한 옛 정보가 단순 재인쇄보다 가격 변동과 이후 반전이 크다. 금융 전문가도 재조합 정보를 잘 알아보지 못했다. 시간이 지나도 재조합에 대한 차별적 반응은 커짐. 워킹페이퍼에는 기사의 48%가 80% 이상 stale이라는 수치가 있다[검색]. — [EconPapers](https://econpapers.repec.org/RePEc:eee:jfinec:v:149:y:2023:i:1:p:92-113), [AEA 2020 초록](https://aeaweb.org/conference/2020/preliminary/paper/riRZrF43)

### Inferences
- Tetlock의 정의는 우리 "종목 + 텍스트 유사도" 구조와 형태가 같아, 묶기 조건의 금융 분야 선례로 쓸 수 있다. 단 그의 목적은 staleness 측정이고 사건 묶기가 아니며 영어 기사다.
- 일일 요약은 그 자체로 재조합물이다. Fedyk·Hodson 결과를 따르면 요약이 새로운 사실처럼 읽히지 않도록 원 기사 시각과 출처를 드러낼 이유가 된다. 요약 UI 효과를 측정한 연구는 아니므로 추론이다.
- 이 근거는 미국·영어권 시장 기준이다. 한국 시장 적용은 별도 검증이 필요하다. 투자 판단이나 수익 근거로 쓰지 않는다.

### Gaps
- 한국 시장의 재탕 뉴스 효과 논문은 이번 검색에서 찾지 못했다.
- 금융 뉴스 전용 사건 클러스터링 논문으로 Discovery News(AAAI 2020)가 검색됐지만 2차 요약 페이지만 확인되어 목록에서 제외했다.
