# 최신성 점검 트러블슈팅

문서 최신성 점검 중 자주 발생하는 문제와 대응 절차.

## 1) `git log` 결과가 비어 있음

- 증상: 특정 `SKILL.md`의 마지막 수정일이 출력되지 않음
- 원인: 신규 파일이 아직 커밋되지 않았거나 경로 오타
- 해결:
  - `git status -- .claude/skills/*/SKILL.md`로 tracked 상태 확인
  - 경로 오타 여부를 `find .claude/skills -name SKILL.md`로 점검

## 2) 오래된 스킬 탐지 스크립트가 오탐지

- 증상: 방금 수정한 스킬이 30일 초과로 표시됨
- 원인: 수정은 했지만 커밋되지 않아 `git log -1` 기준으로 과거 커밋이 조회됨
- 해결:
  - 워킹트리 기준 점검이 필요하면 `git diff --name-only`를 함께 확인
  - 커밋 후 다시 `git log -1 --format='%ar' -- <path>` 실행

## 3) pre-commit freshness 훅이 실행되지 않음

- 증상: `packages/` 변경 후에도 경고가 출력되지 않음
- 원인: 훅 권한 또는 훅 경로 설정 문제
- 해결:
  - 실행 권한 확인: `ls -l .claude/scripts/check-docs-freshness.sh`
  - 훅 등록 상태 확인: `lefthook run pre-commit` 또는 설정 파일 검토

## 4) 매핑되지 않은 소스 경로 경고

- 증상: 코드가 변경됐는데 어떤 스킬을 갱신해야 할지 불명확
- 원인: `소스-스킬 매핑` 테이블에 신규 경로 누락
- 해결:
  - 신규 경로를 `SKILL.md` 매핑 표에 추가
  - 필요한 경우 새 스킬 생성 또는 기존 스킬 범위 조정
