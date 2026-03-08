/**
 * HelpTooltip 콘텐츠 정의
 */

export interface HelpItem {
  title: string;
  description: string;
}

export const helpContent: Record<string, HelpItem> = {
  // 분할 관련
  split: {
    title: "Split (분할)",
    description:
      "AI가 카드 내용을 분석하여 원자적 단위로 분할을 제안합니다. Cloze가 4개 이상인 카드가 대상입니다.",
  },
  splitCandidate: {
    title: "분할 후보",
    description: "분할이 가능한 카드의 총 개수입니다. Cloze가 4개 이상인 카드들이 선정됩니다.",
  },

  // 임베딩 관련
  embedding: {
    title: "임베딩",
    description:
      "OpenAI 임베딩 모델(text-embedding-3-large)로 텍스트를 숫자 벡터로 변환합니다. 이를 통해 카드 간 의미적 유사도를 계산할 수 있습니다.",
  },
  embeddingCoverage: {
    title: "임베딩 커버리지",
    description:
      "전체 카드 중 임베딩이 생성된 카드의 비율입니다. 100%가 되면 모든 카드에 대해 의미 기반 유사성 검사가 가능합니다.",
  },

  // 검증 관련
  factCheck: {
    title: "팩트 체크",
    description:
      "AI가 카드 내용의 사실 여부를 확인합니다. 잘못된 정보나 오래된 내용을 발견할 수 있습니다.",
  },
  freshness: {
    title: "최신성 검사",
    description:
      "기술 관련 정보가 최신 상태인지 확인합니다. 버전, 라이브러리, 프레임워크 정보 등을 검토합니다.",
  },
  similarityJaccard: {
    title: "Jaccard 유사도",
    description:
      "단어 집합과 2-gram을 비교하여 유사도를 계산합니다. 빠르지만 표면적인 유사도만 감지합니다.",
  },
  similarityEmbedding: {
    title: "임베딩 유사도",
    description:
      "텍스트 임베딩을 코사인 유사도로 비교합니다. 의미적으로 유사한 카드를 더 정확하게 탐지합니다.",
  },
  contextCheck: {
    title: "문맥 일관성",
    description:
      "nid 링크로 연결된 카드들 간의 논리적 일관성을 검사합니다. 관련 카드끼리 내용이 충돌하지 않는지 확인합니다.",
  },

  // 프롬프트 버전 관리
  promptVersion: {
    title: "프롬프트 버전",
    description:
      "AI에게 분할 방법을 지시하는 시스템 프롬프트의 버전입니다. 버전별로 다른 규칙과 예제를 적용할 수 있습니다.",
  },
  promptVersionSelect: {
    title: "버전 선택",
    description:
      "분할에 사용할 프롬프트 버전을 선택합니다. 활성화된 버전에는 ✓ 표시가 있습니다. A/B 테스트 시 다른 버전을 선택해볼 수 있습니다.",
  },
  promptHistory: {
    title: "분할 히스토리",
    description:
      "분할이 적용된 기록입니다. 어떤 버전으로 어떤 카드를 분할했는지, 결과가 승인/수정/거부되었는지 추적합니다.",
  },
  promptExperiment: {
    title: "A/B 테스트",
    description:
      "두 프롬프트 버전의 성능을 비교하는 실험입니다. 같은 카드를 다른 버전으로 분할하여 승인률, 평균 글자 수 등을 비교합니다.",
  },
  promptMetrics: {
    title: "프롬프트 메트릭",
    description:
      "프롬프트 버전별 성능 지표입니다. 총 분할 수, 승인률, 수정률, 거부율, 평균 글자 수를 추적합니다.",
  },
  approvalRate: {
    title: "승인률",
    description:
      "분할 결과가 수정 없이 바로 승인된 비율입니다. 높을수록 프롬프트가 사용자 기대에 맞는 결과를 생성합니다.",
  },

  // 기타
  cloze: {
    title: "Cloze",
    description:
      'Anki의 빈칸 채우기 형식입니다. {{c1::답}}처럼 작성하면 "답" 부분이 빈칸으로 표시됩니다.',
  },
  nid: {
    title: "nid (Note ID)",
    description:
      "Anki 노트의 고유 식별자입니다. 13자리 숫자로 구성되며, 카드 간 링크에 사용됩니다.",
  },
  backup: {
    title: "백업",
    description:
      "분할을 적용하기 전에 원본 상태가 자동으로 저장됩니다. 언제든지 롤백하여 원래 상태로 복구할 수 있습니다.",
  },

  // 검증 상태 아이콘
  validationPassed: {
    title: "검증 통과",
    description: "모든 검증 항목을 통과했습니다. 카드 내용에 문제가 없습니다.",
  },
  validationWarning: {
    title: "검토 필요",
    description: "일부 검증 항목에서 주의가 필요한 사항이 발견되었습니다. 내용을 확인해 주세요.",
  },
  validationFailed: {
    title: "검증 실패",
    description: "검증 중 오류가 발생했거나 심각한 문제가 발견되었습니다.",
  },
  validationPending: {
    title: "미검증",
    description: "아직 검증이 수행되지 않았습니다. 카드를 선택하고 검증 버튼을 눌러주세요.",
  },
};
