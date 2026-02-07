/**
 * 도움말 콘텐츠 정의
 * HelpTooltip과 Help 페이지에서 사용
 */

export interface HelpItem {
  title: string;
  description: string;
  learnMore?: string; // Help 페이지 내 앵커 링크
}

export const helpContent: Record<string, HelpItem> = {
  // 분할 관련
  hardSplit: {
    title: "Hard Split",
    description:
      "#### 헤더로 명확히 구분된 카드를 자동으로 분할합니다. 정규식 기반으로 빠르고 정확하게 처리됩니다.",
    learnMore: "/help#hard-split",
  },
  softSplit: {
    title: "Soft Split",
    description:
      "AI(Gemini)가 카드 내용을 분석하여 의미적으로 분할을 제안합니다. Cloze가 3개 이상인 카드가 대상입니다.",
    learnMore: "/help#soft-split",
  },
  splitCandidate: {
    title: "분할 후보",
    description:
      "Hard Split 또는 Soft Split이 가능한 카드의 총 개수입니다. 정보 밀도가 높은 카드들이 선정됩니다.",
    learnMore: "/help#split-candidates",
  },

  // 임베딩 관련
  embedding: {
    title: "임베딩",
    description:
      "텍스트를 768차원의 숫자 벡터로 변환합니다. 이를 통해 카드 간 의미적 유사도를 계산할 수 있습니다.",
    learnMore: "/help#embedding",
  },
  embeddingCoverage: {
    title: "임베딩 커버리지",
    description:
      "전체 카드 중 임베딩이 생성된 카드의 비율입니다. 100%가 되면 모든 카드에 대해 의미 기반 유사성 검사가 가능합니다.",
    learnMore: "/help#embedding",
  },

  // 검증 관련
  factCheck: {
    title: "팩트 체크",
    description:
      "AI가 카드 내용의 사실 여부를 확인합니다. 잘못된 정보나 오래된 내용을 발견할 수 있습니다.",
    learnMore: "/help#fact-check",
  },
  freshness: {
    title: "최신성 검사",
    description:
      "기술 관련 정보가 최신 상태인지 확인합니다. 버전, 라이브러리, 프레임워크 정보 등을 검토합니다.",
    learnMore: "/help#freshness",
  },
  similarityJaccard: {
    title: "Jaccard 유사도",
    description:
      "단어 집합과 2-gram을 비교하여 유사도를 계산합니다. 빠르지만 표면적인 유사도만 감지합니다.",
    learnMore: "/help#similarity",
  },
  similarityEmbedding: {
    title: "임베딩 유사도",
    description:
      "텍스트 임베딩을 코사인 유사도로 비교합니다. 의미적으로 유사한 카드를 더 정확하게 탐지합니다.",
    learnMore: "/help#similarity",
  },
  contextCheck: {
    title: "문맥 일관성",
    description:
      "nid 링크로 연결된 카드들 간의 논리적 일관성을 검사합니다. 관련 카드끼리 내용이 충돌하지 않는지 확인합니다.",
    learnMore: "/help#context",
  },

  // 프롬프트 버전 관리
  promptVersion: {
    title: "프롬프트 버전",
    description:
      "AI에게 분할 방법을 지시하는 시스템 프롬프트의 버전입니다. 버전별로 다른 규칙과 예제를 적용할 수 있습니다.",
    learnMore: "/help#prompt-version",
  },
  promptVersionSelect: {
    title: "버전 선택",
    description:
      "분할에 사용할 프롬프트 버전을 선택합니다. 활성화된 버전에는 ✓ 표시가 있습니다. A/B 테스트 시 다른 버전을 선택해볼 수 있습니다.",
    learnMore: "/help#prompt-version",
  },
  promptHistory: {
    title: "분할 히스토리",
    description:
      "분할이 적용된 기록입니다. 어떤 버전으로 어떤 카드를 분할했는지, 결과가 승인/수정/거부되었는지 추적합니다.",
    learnMore: "/help#prompt-history",
  },
  promptExperiment: {
    title: "A/B 테스트",
    description:
      "두 프롬프트 버전의 성능을 비교하는 실험입니다. 같은 카드를 다른 버전으로 분할하여 승인률, 평균 글자 수 등을 비교합니다.",
    learnMore: "/help#prompt-experiment",
  },
  promptMetrics: {
    title: "프롬프트 메트릭",
    description:
      "프롬프트 버전별 성능 지표입니다. 총 분할 수, 승인률, 수정률, 거부율, 평균 글자 수를 추적합니다.",
    learnMore: "/help#prompt-metrics",
  },
  approvalRate: {
    title: "승인률",
    description:
      "분할 결과가 수정 없이 바로 승인된 비율입니다. 높을수록 프롬프트가 사용자 기대에 맞는 결과를 생성합니다.",
    learnMore: "/help#prompt-metrics",
  },

  // 기타
  cloze: {
    title: "Cloze",
    description:
      'Anki의 빈칸 채우기 형식입니다. {{c1::답}}처럼 작성하면 "답" 부분이 빈칸으로 표시됩니다.',
    learnMore: "/help#glossary",
  },
  nid: {
    title: "nid (Note ID)",
    description:
      "Anki 노트의 고유 식별자입니다. 13자리 숫자로 구성되며, 카드 간 링크에 사용됩니다.",
    learnMore: "/help#glossary",
  },
  backup: {
    title: "백업",
    description:
      "분할을 적용하기 전에 원본 상태가 자동으로 저장됩니다. 언제든지 롤백하여 원래 상태로 복구할 수 있습니다.",
    learnMore: "/help#backup",
  },

  // 검증 상태 아이콘
  validationPassed: {
    title: "검증 통과",
    description: "모든 검증 항목을 통과했습니다. 카드 내용에 문제가 없습니다.",
    learnMore: "/help#validation",
  },
  validationWarning: {
    title: "검토 필요",
    description:
      "일부 검증 항목에서 주의가 필요한 사항이 발견되었습니다. 내용을 확인해 주세요.",
    learnMore: "/help#validation",
  },
  validationFailed: {
    title: "검증 실패",
    description: "검증 중 오류가 발생했거나 심각한 문제가 발견되었습니다.",
    learnMore: "/help#validation",
  },
  validationPending: {
    title: "미검증",
    description:
      "아직 검증이 수행되지 않았습니다. 카드를 선택하고 검증 버튼을 눌러주세요.",
    learnMore: "/help#validation",
  },
};

/**
 * 용어 사전 (Help 페이지용)
 */
export const glossaryItems = [
  {
    term: "Hard Split",
    definition:
      "#### 헤더로 명확히 구분된 카드를 정규식으로 자동 분할하는 방식입니다. 빠르고 정확하지만, 명확한 구분자가 있는 경우에만 사용 가능합니다.",
  },
  {
    term: "Soft Split",
    definition:
      "AI(Gemini)가 카드 내용을 분석하여 의미적으로 분할을 제안하는 방식입니다. Cloze가 3개 이상인 복잡한 카드에 적용됩니다.",
  },
  {
    term: "Cloze",
    definition:
      'Anki의 빈칸 채우기 형식입니다. {{c1::답}} 형태로 작성하면 학습 시 "답" 부분이 빈칸으로 표시됩니다.',
  },
  {
    term: "임베딩 (Embedding)",
    definition:
      "텍스트를 768차원의 숫자 벡터로 변환하는 것입니다. Gemini 임베딩 모델을 사용하며, 의미 기반 유사도 비교에 활용됩니다.",
  },
  {
    term: "nid (Note ID)",
    definition:
      "Anki 노트의 고유 식별자로, 13자리 숫자입니다. [제목|nid1234567890123] 형태로 카드 간 링크를 만들 수 있습니다.",
  },
  {
    term: "Jaccard 유사도",
    definition:
      "두 집합의 교집합을 합집합으로 나눈 값입니다. 단어 집합과 2-gram을 비교하여 텍스트 유사도를 빠르게 계산합니다.",
  },
  {
    term: "코사인 유사도",
    definition:
      "두 벡터 사이의 각도를 측정하는 방식입니다. 임베딩 벡터 간 유사도 계산에 사용되며, -1에서 1 사이의 값을 가집니다.",
  },
  {
    term: "프롬프트 버전",
    definition:
      "AI에게 분할 규칙을 지시하는 시스템 프롬프트의 버전입니다. SuperMemo의 Twenty Rules 기반으로 설계되어 카드 길이, 힌트 규칙 등을 정의합니다.",
  },
  {
    term: "A/B 테스트",
    definition:
      "두 프롬프트 버전을 비교하는 실험입니다. 같은 카드를 다른 버전으로 분할하여 승인률, 평균 글자 수 등 성능을 비교합니다.",
  },
];

/**
 * FAQ 항목 (Help 페이지용)
 */
export const faqItems = [
  {
    question: "분할 후 원래대로 되돌릴 수 있나요?",
    answer:
      "네, 가능합니다. 분할을 적용하기 전에 자동으로 백업이 생성됩니다. Backups 페이지에서 원하는 백업을 선택하여 롤백하면 원래 상태로 복구됩니다.",
  },
  {
    question: "임베딩은 언제 사용하나요?",
    answer:
      '임베딩은 유사성 검사에서 사용됩니다. Jaccard 유사도보다 의미적으로 유사한 카드를 더 정확하게 찾아냅니다. Dashboard에서 "임베딩 생성" 버튼을 눌러 미리 생성해두면 검사가 빨라집니다.',
  },
  {
    question: "API 비용은 얼마나 드나요?",
    answer:
      "Soft Split과 검증 기능은 Gemini API를 사용합니다. Gemini 3 Flash Preview는 무료 티어가 넉넉하며, 일반적인 사용량에서는 비용이 거의 발생하지 않습니다.",
  },
  {
    question: "Hard Split과 Soft Split 중 어떤 것을 사용해야 하나요?",
    answer:
      "카드에 #### 헤더가 명확히 있다면 Hard Split이 사용됩니다. 그렇지 않은 경우 Soft Split이 AI의 판단으로 분할을 제안합니다. 시스템이 자동으로 적절한 방식을 선택합니다.",
  },
  {
    question: "검증은 꼭 해야 하나요?",
    answer:
      "필수는 아니지만 권장됩니다. 팩트 체크로 잘못된 정보를, 최신성 검사로 오래된 기술 정보를 발견할 수 있습니다. 유사성 검사는 중복 카드를 찾는 데 유용합니다.",
  },
  {
    question: "프롬프트 버전은 어떻게 사용하나요?",
    answer:
      "Split 페이지 헤더에서 프롬프트 버전을 선택할 수 있습니다. 기본적으로 활성화된 버전이 선택되며, A/B 테스트를 위해 다른 버전을 선택해볼 수 있습니다.",
  },
  {
    question: "승인률이 낮으면 어떻게 해야 하나요?",
    answer:
      "Prompts 페이지의 메트릭 탭에서 버전별 성능을 비교하세요. 승인률이 낮으면 프롬프트 규칙을 조정하거나, 새 버전을 만들어 A/B 테스트로 비교해볼 수 있습니다.",
  },
];
