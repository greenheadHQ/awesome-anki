# 프롬프트 트러블슈팅

## export 이름 충돌

- **문제**: `getVersion`이 AnkiConnect와 prompt-version 양쪽에 존재
- **해결**: prompt-version 함수에 접두사 사용
  - `getVersion` → `getPromptVersion`
  - `listVersions` → `listPromptVersions`

## Phase 1 프롬프트 개선 결정사항

### SYSTEM_PROMPT 전면 개편
- SuperMemo's Twenty Rules 기반으로 재설계
- 카드 길이 기준 명시 (Cloze 40~60자, Basic Front 20~30자)
- 필수 원칙 6가지 추가
- Self-Correction 루프 추가
- 부정형 질문 방지 규칙

### buildSplitPrompt 개선
- `cardType`, `charCount`, `contextTag`, `qualityChecks` 필드 추가
- Gemini 응답에 품질 메타데이터 포함

### Cloze Enhancer 신규 생성
- 이진 패턴 25개 자동 감지
- Yes/No Cloze에 힌트 자동 추가
- `cloze-enhancer.ts` 신규 파일

### validator.ts 스키마 확장
- `SplitCard`에 `cardType`, `charCount`, `contextTag` 추가
- `QualityChecks` 인터페이스 추가

## SplitWorkspace 버전 선택

- 헤더 드롭다운에서 프롬프트 버전 선택 가능
- 활성 버전에 ✓ 표시
- 선택된 버전의 시스템 프롬프트로 Gemini 분석 요청

## 히스토리 자동 기록

- 분할 적용 시 `/api/prompts/history`로 자동 전송
- `userAction: 'approved'` 자동 기록
- promptVersionId, noteId, splitCards 저장
