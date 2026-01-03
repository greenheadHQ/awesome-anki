# Anki Claude Code - LLM 가이드

## 프로젝트 개요

Anki 카드를 원자적 단위로 분할하는 Claude Code 스킬. 정보 밀도 높은 카드를 학습 효율이 좋은 작은 카드들로 분리.

## 핵심 컨텍스트

### 환경
- **런타임**: bun (npm 아님)
- **Anki 프로필**: 반드시 `test` 프로필에서만 작업 (`open -a Anki --args -p test`)
- **AnkiConnect**: localhost:8765 (애드온 코드: 2055492159)
- **대상 모델**: `KaTeX and Markdown Cloze` (필드: Text, Back Extra)
- **LLM**: `gemini-3-flash-preview` (구조화된 출력 지원, 1M 토큰 입력)

### 테스트 데이터
- 덱: `[책] 이것이 취업을 위한 컴퓨터 과학이다` (262개 노트)
- 1차 테스트 카드 (DNS 관련, nid 링크 많음):
  - 1757399484677: 도메인 네임의 계층적 구조
  - 1757400981612: 네임 서버의 계층적 구조
  - 1757407967676: DNS 레코드 타입

## 아키텍처

```
src/
├── index.ts              # CLI 진입점 (status, split, analyze)
├── anki/
│   ├── client.ts         # AnkiConnect API 래퍼
│   └── operations.ts     # nid 승계 전략 (updateNoteFields vs addNotes)
├── parser/
│   ├── container-parser.ts  # ::: 블록 파싱 (상태 머신)
│   ├── nid-parser.ts        # [제목|nid...] 링크 파싱
│   └── cloze-parser.ts      # {{c1::...}} 파싱
├── gemini/
│   ├── client.ts         # Gemini API 호출
│   ├── prompts.ts        # 분할 프롬프트
│   └── validator.ts      # zod 스키마 검증
├── splitter/
│   └── atomic-converter.ts  # Hard Split (정규식 기반)
└── utils/
    ├── diff-viewer.ts    # chalk 기반 미리보기
    └── formatters.ts     # HTML 스타일 보존
```

## 분할 전략

### Hard Split (구현 완료)
- `####` 헤더나 `---` 구분선으로 명확히 분리되는 경우
- 정규식 기반으로 빠르고 정확

### Soft Split (구현 완료)
- 구분자 없지만 정보 밀도 높은 경우 (Cloze > 3개)
- Gemini 3 Flash Preview에게 분할 제안 요청
- 처음 5개 후보만 분석 (API 비용 고려)

### nid 승계 전략
- `mainCardIndex` 카드: `updateNoteFields`로 기존 nid 유지
- 서브 카드들: `addNotes`로 새 nid 생성 + 역링크 삽입

## 시행착오 및 결정사항

### 1. 컨테이너 파서 설계
- **문제**: 정규식만으로는 중첩 `::: toggle` 처리 불가
- **해결**: 상태 머신 방식 (스택 기반 depth 추적)

### 2. Cloze 번호 처리
- **결정**: 분할 후 모든 카드는 `{{c1::}}`로 리셋 (1 Note = 1 Atomic Card 원칙)

### 3. todo 블록 처리
- **규칙**: `::: toggle todo` 블록은 분할 대상에서 제외 (미완성 상태)
- **플래그**: purple 플래그 카드도 주의 필요

### 4. 스타일 보존
- 반드시 보존해야 하는 HTML: `<span style="color:...">`, `<font color>`, `<b>`, `<u>`, `<sup>`
- `formatters.ts`에서 검증 로직 제공

## 미구현 기능

1. **rollback**: 변경 되돌리기
2. **학습 데이터 복제**: 분할 카드에 원본 학습 이력 복사
3. **전체 Soft Split**: 현재 5개만 분석 (전체 후보 분석 미지원)

## 실행 방법

```bash
# 연결 확인
bun run status

# 분할 미리보기 (Hard + Soft Split)
bun run split

# 분할 실제 적용 (⚠️ 주의)
bun run split --apply

# 특정 카드 분석
bun run src/index.ts analyze "[책] 이것이 취업을 위한 컴퓨터 과학이다" 1757399484677
```

## 주의사항

- `.env`에 `GEMINI_API_KEY` 필요 (Soft Split용)
- 기본 Anki 프로필 접근 금지 (test 프로필만 사용)
- `--apply` 없이 항상 미리보기 먼저 확인
