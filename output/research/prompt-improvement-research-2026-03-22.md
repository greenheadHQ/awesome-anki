# Anki 카드 분할 프롬프트 개선을 위한 종합 리서치 보고서

> 2026-03-22 | 15개 Opus 에이전트 병렬 리서치 결과 종합

---

## 핵심 결론 한 줄 요약

**"최소 정보(Minimum Information)"는 "최소 글자수"가 아니라 "하나의 인출 대상 + 충분한 맥락 단서"이다.**

---

## I. 현재 프롬프트의 근본적 문제 진단

### 1. Wozniak 자신의 명시적 선언

> "Minimum information principle does not mean minimum number of characters in your deck."
> — supermemo.guru

현재 프롬프트는 Rule 4(최소 정보)만 극대화하고 Rule 16(맥락 단서)을 무시한다.
**Wozniak의 20 Rules에서 Rule 4와 Rule 16은 한 세트다.**

### 2. v1.0.0 메트릭이 증명하는 실패

| 메트릭 | 값 | 시사점 |
|--------|-----|--------|
| avgCharCount | 96자 | 80자 한도를 일상적으로 초과 |
| approvalRate | 0% | 단 한 건도 승인되지 않음 |
| rejectedCount | 1 | 사유: "too-granular" |

### 3. 인지과학이 말하는 맥락 제거의 위험

| 원리 | 맥락 제거의 결과 |
|------|----------------|
| 부호화 특수성 (Tulving) | 인출 경로 자체가 끊어짐 |
| 바람직한 어려움 (Bjork) | "바람직하지 않은 어려움"에 해당 |
| 인지 부하 이론 (Sweller) | "이게 뭔지 파악하기"에 외재적 부하 과다 |
| 전이 적합 처리 | 실제 사용 맥락으로의 전이 실패 |

### 4. FSRS 관점: 맥락 제거 → Difficulty 상승

- 맥락 없는 카드 → Again 증가 → D 상승 → 리뷰 빈도 증가 → 악순환
- D < 5 건강, D 5-7 경고, D > 7 재설계 필요
- **최적 분할 = 복잡성 줄이되 인출 단서 보존**

---

## II. 개선 방향: 5대 원칙

### 원칙 1: "길거리 쪽지 테스트" (Context Embedding)

> 카드를 길에서 주운 쪽지처럼 봤을 때, 무엇에 대한 질문인지 즉시 이해 가능해야 한다.
> — Control-Alt-Backspace

**나쁜 예 (현재):**
```
JS 엔진이 순차 실행 전에 거치는 준비 단계는 {{c1::평가 과정}}이다 (42자)
```

**좋은 예 (개선):**
```
[JavaScript 실행 모델] JS 엔진은 코드를 한 줄씩 실행하기 전에
변수·함수 선언을 먼저 메모리에 등록하는 {{c1::평가(evaluation) 과정}}을 거친다
```

### 원칙 2: 지식 유형별 차등 전략 (Situational Atomicity)

| 지식 유형 | 카드 형식 | 원자성 수준 | 길이 유연성 |
|-----------|----------|------------|------------|
| **사실적** (수치, 용어, 정의) | Cloze | 최대 | 40-60자 |
| **개념적** (원리, 인과, 관계) | Basic Q&A "왜?" | 중간 | Back 2-3줄 허용 |
| **절차적** (프로세스, 알고리즘) | 개요 + 단계별 카드 | 유연 | 순서 맥락 보존 |
| **비교/대조** | 단일 축 비교 카드 | 중간 | 이진 힌트 필수 |
| **메타인지적** (판단, 전략) | 시나리오 기반 Q&A | 유연 | 조건-판단 형식 |

### 원칙 3: 글자수 제한 완화 + 시간 기반 대안

**현재 (너무 엄격):**

| 타입 | 목표 | 최대 |
|------|------|------|
| Cloze | 40-60자 | 80자 |
| Basic Front | 20-30자 | 40자 |
| Basic Back | ~20자 | 30자 |

**권장 (근거 기반):**

| 타입 | 목표 | 경고선 | 강제 상한 | 비고 |
|------|------|--------|----------|------|
| Cloze | 40-80자 | 100자 | 120자 | **맥락 태그 제외** |
| Basic Front | 20-50자 | 60자 | 70자 | |
| Basic Back | 15-40자 | 50자 | 60자 | |

**시간 기반 보조 기준:** 카드 읽기 + 인출 + 답변 = **8-12초**

### 원칙 4: Back Extra 필드 전략적 활용

AnKing의 "접이식 힌트 버튼" 패턴 적용:
- **앞면/뒷면은 최소 정보** 유지 (빠른 리뷰)
- **Back Extra에 정교화 맥락 적재** (선택적 참조)

```
[Back Extra 예시]
📖 원본: [책] 이것이 취업을 위한 CS이다 > Ch.5 DNS
🔗 관련: 도메인 네임 계층 | 네임 서버 계층 | DNS 레코드 타입
💡 왜: DNS가 계층적 구조인 이유 → 분산 관리로 단일 장애점 방지
```

### 원칙 5: "카드는 원자적, 덱은 정교하게" (Holistic Ideas, Atomic Flashcards)

- 개별 카드: 8초 내 답변 가능
- 하나의 개념에 대해: **2-5개 다각도 카드** (고아 프롬프트 금지)
  - 사실 카드 + "왜?" 카드 + 적용 카드 + 비교 카드

---

## III. 프롬프트 구조 개선 (프롬프트 엔지니어링)

### 1. 구조 재배치: Goal → Output → Limits → Data → Evaluation

현재: 규칙(Limits)이 상단, Goal이 암묵적
개선: Goal을 최상단에 명시

### 2. 부정형 지시 → 긍정형 전환

| 현재 (부정형) | 개선 (긍정형) |
|-------------|-------------|
| "목록 나열 금지" | "목록 항목은 각각 개별 카드로 분리한다" |
| "Yes/No 답변 금지" | "이진 답변에는 반드시 힌트를 포함한다" |
| "예시 함정 금지" | "예시가 필요하면 역방향 질문으로 전환한다" |

### 3. Few-shot 예시 확대: 3개 → 5-8개

각 예시에 **추론 과정(CoT)** 포함:
```
[예시] 원본: "TCP 3-way handshake: SYN → SYN-ACK → ACK로 연결 확립"
[추론] 절차적 지식 → 단계별 분해 + 전체 개요 카드
[결과] 4장: 개요 1장 + 단계별 3장 (각각 맥락 태그 포함)
```

### 4. 지식 유형 판별 단계 추가 (분할 전 필수)

```
## 분할 전 분류 (MUST)
원본 카드의 각 정보를 분류:
1. 사실적 → Cloze, 최대 원자성
2. 개념적 → Basic Q&A "왜?", Back 확장 허용
3. 절차적 → 개요 카드 + 단계별 카드
4. 비교/대조 → 비교 축별 분리
5. 메타인지적 → 시나리오 기반 Q&A
```

### 5. Self-Correction 루프 강화

현재 3줄 → 확장:
```
1. 글자 수 계산 (맥락 태그 제외)
2. "길거리 쪽지 테스트": 맥락 없이 이해 가능한가?
3. "답이 하나뿐인가?"
4. "왜 이것이 맞는지 설명 가능한가?" (사실 카드 외)
5. 불합격 시 수정 + 사유를 qualityChecks에 기록
```

---

## IV. CS 특화 개선

### 1. CS 이진 힌트 확장

현재: 있다/없다, 증가/감소, 동기/비동기, 연결/비연결, 상태/무상태, 가능/불가능

추가:
- 선점/비선점: `{{c1::선점형::Preemptive | Non-preemptive}}`
- 동적/정적: `{{c1::동적::Dynamic | Static}}`
- 컴파일/인터프리트: `{{c1::컴파일::Compiled | Interpreted}}`
- 직렬/병렬: `{{c1::병렬::Serial | Parallel}}`
- 블로킹/논블로킹: `{{c1::Non-blocking::Blocking | Non-blocking}}`

### 2. 프로세스 분해 규칙

3단계 이상의 프로세스 → 개요 카드 1장 + 단계별 카드 + "왜 이 순서?" Basic 카드

### 3. 코드 스니펫 규칙

1-5줄 제한, 핵심 부분만 Cloze, 구문 하이라이팅 유지

### 4. 계층 구조 카드

DNS, OSI, 자료구조 분류 등 → 각 레벨별 카드 생성 + 계층 태그

---

## V. 카드 간 연결 (분할 후 맥락 유지)

### 1. 분할 그룹 태그 자동 부여
```
split::nid_1757399484677
```

### 2. Back Extra에 breadcrumb 자동 주입
```
📖 원본: nid:1757399484677 | 도메인 네임의 계층적 구조
🔗 함께 학습: 네임 서버 계층, DNS 레코드 타입
```

### 3. 허브 카드 (선택적)
분할된 세부 카드들을 개념적으로 묶는 개요 카드

---

## VI. 핵심 참고 자료 (Top 20)

| 자료 | 핵심 기여 |
|------|----------|
| [SuperMemo 20 Rules - supermemo.guru](https://supermemo.guru/wiki/20_rules_of_knowledge_formulation) | Wozniak의 최신 해석, 규칙 진화 |
| [Minimum Information Principle - supermemo.guru](https://supermemo.guru/wiki/Minimum_information_principle) | "≠ minimum characters" 명시 |
| [Andy Matuschak - How to write good prompts](https://andymatuschak.org/prompts/) | 프롬프트 설계 체계, 고아 프롬프트 금지 |
| [Matuschak - Cloze produces less understanding](https://notes.andymatuschak.org/zPJt42JTcoAPTTTa2vdDonV) | Cloze의 "패턴 매칭" 함정 |
| [Matuschak - LLMs lack patterns for conceptual material](https://notes.andymatuschak.org/zGkLPdiEs7Qohkesq7TNiBe) | AI 카드 생성의 구조적 한계 |
| [Michael Nielsen - Augmenting Long-term Memory](https://augmentingcognition.com/) | 골격적 의미망, 고아 프롬프트 방지 |
| [Control-Alt-Backspace - Precise Cards](https://controlaltbackspace.org/precise/) | 길거리 쪽지 테스트, 컨텍스트 프라이밍 |
| [LeanAnki - Creating Better Flashcards](https://leananki.com/creating-better-flashcards/) | EAT 원칙, "Holistic ideas, Atomic flashcards" |
| [LeanAnki - Cards for Processes](https://leananki.com/cards-for-processes/) | 절차적 지식 카드 설계 |
| [The Big Picture Problem - Anki Forums](https://forums.ankiweb.net/t/the-big-picture-problem-with-anki/46516) | 과잉 원자화의 big picture 상실 문제 |
| [AnKing Note Types - GitHub](https://github.com/AnKing-VIP/AnKing-Note-Types) | 다층 필드 시스템, 접이식 힌트 버튼 |
| [FSRS Algorithm Wiki](https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm) | D-S-R 모델, 카드 디자인과 난이도 |
| [Bjork - Desirable Difficulties](https://bjorklab.psych.ucla.edu/wp-content/uploads/sites/13/2016/04/EBjork_RBjork_2011.pdf) | 바람직한 vs 바람직하지 않은 어려움 |
| [Encoding Specificity - Tulving](https://en.wikipedia.org/wiki/Encoding_specificity_principle) | 맥락 = 인출 인프라 |
| [Cloze Meta-analysis 2025](https://www.sciencedirect.com/science/article/pii/S0160289625000650) | 89개 연구, 37,912명 |
| [Element Interactivity 2024](https://www.sciencedirect.com/science/article/pii/S0361476X24000262) | 상호의존적 개념 무분별 분할 → 학습 방해 |
| [G-Research - Anki CS Edition](https://www.gresearch.com/news/anki-as-learning-superpower-computer-science-edition/) | CS 특화 카드 설계 |
| [Gwern - Spaced Repetition](https://gwern.net/spaced-repetition) | 5분 규칙, 실증 데이터 |
| [LessWrong - Opinionated Anki Guide](https://www.lesswrong.com/posts/7Q7DPSk4iGFJd8DRk/an-opinionated-guide-to-using-anki-correctly) | 핸들/레벨 시스템 |
| [rs.io - 10,000 Flashcards](https://rs.io/anki-tips/) | Why > What, 이미지 활용 |

---

## VII. 핵심 인용문 모음

> "Minimum information principle does not mean minimum number of characters in your deck."
> — Piotr Wozniak

> "Context cues simplify wording — providing context is a way of simplifying memories."
> — Wozniak, Rule 16

> "Items without examples were forgotten 20 times within one year, while the same item with an example was not forgotten even once in ten repetitions spread over five years."
> — Wozniak, on interference

> "I make it a rule to never put in just one question, instead trying to put at least two, preferably three or more."
> — Andy Matuschak, on orphan prompts

> "The resulting prompts tend to reinforce the surface — what is said, rather than what it means or why it matters."
> — Matuschak, on LLM-generated cards

> "Cloze deletion prompts seem to produce less understanding than question-answer pairs."
> — Andy Matuschak

> "Have holistic ideas, but atomic flashcards."
> — LeanAnki

> "Questions should be 100% comprehensible without any surrounding context."
> — Control-Alt-Backspace (길거리 쪽지 테스트)

> "Interference is probably the single greatest cause of forgetting in collections for experienced users."
> — Wozniak

> "Redundancy does not contradict minimum information principle."
> — Wozniak, Rule 17
