/**
 * 프롬프트 버전 관리 타입 정의
 */

/**
 * Few-shot 예제
 */
export interface FewShotExample {
  input: string;
  output: string;
  description: string;
  isGoodExample: boolean;
}

/**
 * 프롬프트 설정
 */
export interface PromptConfig {
  // 카드 길이 기준
  maxClozeChars: number; // Cloze 최대 글자 수 (기본 80)
  targetClozeChars: number; // Cloze 목표 글자 수 (기본 50)
  maxBasicFrontChars: number; // Basic Front 최대 글자 수 (기본 40)
  targetBasicFrontChars: number; // Basic Front 목표 글자 수 (기본 25)
  maxBasicBackChars: number; // Basic Back 최대 글자 수 (기본 30)
  targetBasicBackChars: number; // Basic Back 목표 글자 수 (기본 20)

  // Cloze 규칙
  maxClozePerCard: number; // 카드당 최대 Cloze 수 (기본 1)
  requireHintForBinary: boolean; // 이진 패턴 힌트 필수 (기본 true)

  // 카드 타입
  allowBasicCards: boolean; // Basic 카드 허용 (기본 true)
  preferBasicForWhy: boolean; // "왜?" 질문에 Basic 선호 (기본 true)

  // 맥락
  requireContextTag: boolean; // 중첩 맥락 태그 필수 (기본 true)
  contextTagDepth: number; // 맥락 태그 깊이 (기본 2-3)
}

/**
 * 프롬프트 버전 메트릭
 */
export interface PromptMetrics {
  totalSplits: number; // 총 분할 횟수
  approvedCount: number; // 승인된 분할
  modifiedCount: number; // 수정된 분할
  rejectedCount: number; // 거부된 분할
  approvalRate: number; // 승인률 (0-100)
  avgCardsPerSplit: number; // 분할당 평균 카드 수
  avgCharCount: number; // 평균 글자 수
  lastUsedAt: string; // 마지막 사용 시간 (ISO 8601)
}

/**
 * 수정 패턴 (실패 패턴 분석용)
 */
export interface ModificationPatterns {
  lengthReduced: number; // 글자 수 줄임 횟수
  contextAdded: number; // 맥락 추가 횟수
  clozeChanged: number; // Cloze 변경 횟수
  cardsMerged: number; // 카드 병합 횟수
  cardsSplit: number; // 추가 분할 횟수
  hintAdded: number; // 힌트 추가 횟수
}

/**
 * 프롬프트 버전
 */
export interface PromptVersion {
  id: string; // 버전 ID (예: "v1.0.0")
  name: string; // 버전 이름 (예: "SuperMemo 기반 최적화")
  description: string; // 버전 설명
  createdAt: string; // 생성 시간 (ISO 8601)
  updatedAt: string; // 수정 시간 (ISO 8601)

  // 프롬프트 내용
  systemPrompt: string; // 시스템 프롬프트
  splitPromptTemplate: string; // 분할 프롬프트 템플릿
  analysisPromptTemplate: string; // 분석 프롬프트 템플릿

  // 예제
  examples: FewShotExample[];

  // 설정
  config: PromptConfig;

  // 상태
  status: "draft" | "active" | "archived";

  // 메트릭
  metrics: PromptMetrics;

  // 수정 패턴
  modificationPatterns: ModificationPatterns;

  // 부모 버전 (A/B 테스트용)
  parentVersionId?: string;
  changelog?: string;
}

/**
 * 분할 히스토리 항목
 */
export interface SplitHistoryEntry {
  id: string; // 히스토리 ID
  timestamp: string; // 분할 시간 (ISO 8601)
  promptVersionId: string; // 사용된 프롬프트 버전
  noteId: number; // 원본 노트 ID
  deckName: string; // 덱 이름

  // 입력
  originalContent: string; // 원본 카드 내용
  originalCharCount: number; // 원본 글자 수

  // 출력
  splitCards: Array<{
    title: string;
    content: string;
    cardType: "cloze" | "basic";
    charCount: number;
    contextTag?: string;
  }>;

  // 사용자 액션
  userAction: "approved" | "modified" | "rejected";
  modificationDetails?: {
    lengthReduced: boolean;
    contextAdded: boolean;
    clozeChanged: boolean;
    cardsMerged: boolean;
    cardsSplit: boolean;
    hintAdded: boolean;
  };

  // 품질 체크
  qualityChecks: {
    allCardsUnder80Chars: boolean;
    allClozeHaveHints: boolean;
    noEnumerations: boolean;
    allContextTagsPresent: boolean;
  } | null;
}

/**
 * A/B 테스트 실험
 */
export interface Experiment {
  id: string; // 실험 ID
  name: string; // 실험 이름
  createdAt: string; // 생성 시간
  status: "running" | "completed" | "cancelled";

  // 비교 버전
  controlVersionId: string; // 대조군 버전 ID
  treatmentVersionId: string; // 실험군 버전 ID

  // 결과
  controlResults: {
    splitCount: number;
    approvalRate: number;
    avgCharCount: number;
  };
  treatmentResults: {
    splitCount: number;
    approvalRate: number;
    avgCharCount: number;
  };

  // 결론
  conclusion?: string;
  winnerVersionId?: string;
}

/**
 * 활성 버전 정보
 */
export interface ActiveVersionInfo {
  versionId: string;
  activatedAt: string;
  activatedBy: string; // "user" | "system" | "experiment"
}

/**
 * 기본 프롬프트 설정
 */
export const DEFAULT_PROMPT_CONFIG: PromptConfig = {
  maxClozeChars: 80,
  targetClozeChars: 50,
  maxBasicFrontChars: 40,
  targetBasicFrontChars: 25,
  maxBasicBackChars: 30,
  targetBasicBackChars: 20,
  maxClozePerCard: 1,
  requireHintForBinary: true,
  allowBasicCards: true,
  preferBasicForWhy: true,
  requireContextTag: true,
  contextTagDepth: 2,
};

/**
 * 기본 메트릭
 */
export const DEFAULT_METRICS: PromptMetrics = {
  totalSplits: 0,
  approvedCount: 0,
  modifiedCount: 0,
  rejectedCount: 0,
  approvalRate: 0,
  avgCardsPerSplit: 0,
  avgCharCount: 0,
  lastUsedAt: "",
};

/**
 * 기본 수정 패턴
 */
export const DEFAULT_MODIFICATION_PATTERNS: ModificationPatterns = {
  lengthReduced: 0,
  contextAdded: 0,
  clozeChanged: 0,
  cardsMerged: 0,
  cardsSplit: 0,
  hintAdded: 0,
};
