# 모노레포 아키텍처 상세

## 패키지 구조

```
anki-claude-code/
├── packages/
│   ├── core/                 # 핵심 로직
│   │   └── src/
│   │       ├── anki/         # AnkiConnect API 래퍼
│   │       │   ├── client.ts     # ankiConnect(action, params) 함수
│   │       │   ├── operations.ts # 카드 CRUD, 분할 적용
│   │       │   ├── backup.ts     # 백업, 롤백
│   │       │   └── scheduling.ts # ease factor 복제
│   │       ├── llm/          # 멀티 LLM 추상화 계층
│   │       │   ├── factory.ts   # createLLMClient, getDefaultModelId
│   │       │   ├── gemini.ts    # GeminiAdapter (LLMProvider 구현)
│   │       │   ├── openai.ts    # OpenAIAdapter (LLMProvider 구현)
│   │       │   ├── pricing.ts   # 모델 가격표, 비용 계산, 예산 가드레일
│   │       │   ├── types.ts     # LLMProvider 인터페이스, TokenUsage, CostEstimate
│   │       │   └── index.ts     # barrel export
│   │       ├── gemini/       # Gemini 전용 API
│   │       │   ├── client.ts         # Gemini API 기본 클라이언트
│   │       │   ├── prompts.ts        # 시스템/분할 프롬프트 (SuperMemo 기반)
│   │       │   ├── validator.ts      # 응답 검증 (zod 스키마)
│   │       │   └── cloze-enhancer.ts # 이진 패턴 감지, 힌트 추가
│   │       ├── parser/       # 텍스트 파싱
│   │       │   ├── container-parser.ts # ::: 구문 (상태 머신)
│   │       │   ├── nid-parser.ts      # [제목|nid...] 링크
│   │       │   └── cloze-parser.ts    # {{c1::...}} 구문
│   │       ├── splitter/     # 분할 로직
│   │       │   └── atomic-converter.ts # Split, analyzeForSplit
│   │       ├── validator/    # 카드 검증
│   │       │   ├── types.ts             # 검증 결과 타입
│   │       │   ├── fact-checker.ts      # Gemini 팩트 체크
│   │       │   ├── freshness-checker.ts # 최신성 검사
│   │       │   ├── similarity-checker.ts # Jaccard + 임베딩 유사도
│   │       │   └── context-checker.ts   # nid 기반 문맥 일관성
│   │       ├── embedding/    # Gemini 임베딩
│   │       │   ├── client.ts  # getEmbedding, getEmbeddings
│   │       │   ├── cosine.ts  # 코사인 유사도
│   │       │   └── cache.ts   # 파일 기반 증분 캐시
│   │       ├── prompt-version/ # 프롬프트 버전 관리
│   │       │   ├── types.ts    # PromptVersion 등 11개 타입
│   │       │   └── storage.ts  # CRUD, 히스토리, 실험
│   │       ├── errors.ts      # 커스텀 에러 클래스 (AppError 계층)
│   │       └── utils/        # 유틸리티
│   │           ├── formatters.ts    # HTML 스타일 보존, 검증
│   │           └── atomic-write.ts  # 원자적 파일 쓰기, 뮤텍스
│   │
│   ├── server/               # Hono REST API 서버
│   │   └── src/
│   │       ├── index.ts      # 서버 진입점 (localhost:3000)
│   │       └── routes/       # API 라우트
│   │           ├── decks.ts, cards.ts, split.ts
│   │           ├── backup.ts, validate.ts
│   │           ├── embedding.ts, prompts.ts
│   │           ├── llm.ts, history.ts, media.ts
│   │
│   └── web/                  # React 프론트엔드
│       └── src/
│           ├── pages/        # Dashboard, SplitWorkspace, CardBrowser,
│           │                 # BackupManager, PromptManager, SplitHistory, Help
│           ├── components/   # card/, help/, layout/, ui/, validation/
│           ├── hooks/        # useCards, useSplit, usePrompts 등
│           └── lib/          # api.ts, query-keys.ts, helpContent.ts
│
└── output/
    ├── backups/              # 분할 전 상태 백업 (JSON)
    ├── embeddings/           # 임베딩 캐시 (JSON)
    └── prompts/              # 프롬프트 버전, 히스토리, 실험
```

## workspaces 설정

`package.json`의 `"workspaces": ["packages/*"]`로 bun workspace 관리.

각 패키지는 독립적인 `package.json`과 `tsconfig.json` 보유.
