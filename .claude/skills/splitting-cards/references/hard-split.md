# Hard Split 상세

## 기준

- `####` (h4) 헤더가 **2개 이상** 있을 때만 분할 가능
- 각 `####` 섹션이 하나의 독립 카드가 됨

## 설계 결정: --- 구분선 제외

- **이전**: `---` 또는 `####` 헤더가 있으면 `canHardSplit: true`
- **변경 후**: `####` 헤더만 기준, `---` 구분선은 완전히 제외
- **이유**: 사용자가 `---`를 카드 분할 용도로 사용하지 않음

## 구현

```typescript
// packages/core/src/splitter/atomic-converter.ts
const headerCount = hardSplitPoints.filter((p) => p.type === 'header').length;
return {
  canHardSplit: headerCount >= 2,  // 최소 2개 이상의 헤더
  canSoftSplit: !canHardSplit && clozes.length > 3,
  // ...
};
```

## 동작 방식

1. 텍스트에서 `####` 패턴 탐색
2. 각 `####` 섹션을 독립 카드로 분리
3. 메인 카드는 기존 nid 유지 (mainCardIndex)
4. 나머지는 새 노트로 생성

## 비용

- 정규식 기반이므로 API 호출 없음 (비용 없음)
- 카드 선택 시 자동 미리보기 가능
